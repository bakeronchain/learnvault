import { type Response } from "express"
import { pool } from "../db/index"
import { logger } from "../lib/logger"
import { type AuthRequest } from "../middleware/auth.middleware"
import { stellarContractService } from "../services/stellar-contract.service"

const log = logger.child({ module: "enrollments" })

const COURSE_MILESTONE_CONTRACT_ID =
	process.env.COURSE_MILESTONE_CONTRACT_ID ?? ""

/**
 * Create a new enrollment for a learner in a course.
 * Validates on-chain enrollment first.
 */
export const createEnrollment = async (
	req: AuthRequest,
	res: Response,
): Promise<void> => {
	try {
		const walletAddress = req.walletAddress
		if (!walletAddress) {
			res.status(401).json({ error: "Unauthorized" })
			return
		}

		const { learner_address, course_id, tx_hash } = req.body

		if (!learner_address || !course_id || !tx_hash) {
			res.status(400).json({
				error: "learner_address, course_id, and tx_hash are required",
			})
			return
		}

		if (learner_address !== walletAddress) {
			res.status(400).json({
				error: "learner_address must match the authenticated user",
			})
			return
		}

		const courseResult = await pool.query(
			`SELECT id FROM courses WHERE slug = $1 OR id::text = $1 LIMIT 1`,
			[course_id],
		)
		if (courseResult.rows.length === 0) {
			res.status(404).json({ error: "Course not found" })
			return
		}

		// Validate on-chain enrollment if contract ID is configured
		// Only perform on-chain check if course_id is a numeric string
		// (the contract uses u32 for course IDs, not string slugs)
		if (COURSE_MILESTONE_CONTRACT_ID) {
			// Try to parse course_id as a number
			const courseIdNum = parseInt(course_id, 10)

			if (!isNaN(courseIdNum) && courseIdNum > 0) {
				// It's a valid numeric course ID, check on-chain
				const isEnrolledOnChain = await stellarContractService.isEnrolled(
					learner_address,
					courseIdNum,
					{ requestId: req.requestId },
				)

				if (!isEnrolledOnChain) {
					res.status(400).json({
						error: "Learner is not enrolled in this course on-chain",
					})
					return
				}
			} else {
				// course_id is a string slug (e.g., "stellar-basics")
				// Skip on-chain validation - mapping from slug to contract ID
				// would require additional database logic
				log.warn(
					{ courseId: course_id },
					"course_id is not numeric, skipping on-chain validation",
				)
			}
		} else {
			// If no contract configured, allow enrollment (development mode)
			log.warn(
				"No COURSE_MILESTONE_CONTRACT_ID configured, skipping on-chain validation",
			)
		}

		// Check if already enrolled in DB
		const existingCheck = await pool.query(
			"SELECT id FROM enrollments WHERE learner_address = $1 AND course_id = $2",
			[learner_address, course_id],
		)

		if (existingCheck.rows.length > 0) {
			res.status(409).json({
				error: "Already enrolled in this course",
			})
			return
		}

		// Validate prerequisites
		const courseResult = await pool.query(
			"SELECT id, slug, title, prerequisites FROM courses WHERE slug = $1 OR id::text = $1",
			[course_id],
		)
		if (courseResult.rows.length === 0) {
			res.status(404).json({
				error: "Course not found",
			})
			return
		}

		const course = courseResult.rows[0]
		const prerequisites = course.prerequisites || []

		if (prerequisites.length > 0) {
			const prereqsResult = await pool.query(
				"SELECT id, slug, title FROM courses WHERE id = ANY($1::integer[])",
				[prerequisites],
			)
			const prereqSlugs = prereqsResult.rows.map((r: { slug: string }) => r.slug)

			const completedResult = await pool.query(
				"SELECT course_id FROM scholar_nfts WHERE scholar_address = $1 AND course_id = ANY($2::text[]) AND revoked = FALSE",
				[learner_address, prereqSlugs],
			)

			const completedSlugs = new Set(completedResult.rows.map((r: { course_id: string }) => r.course_id))
			const unmet = []
			for (const r of prereqsResult.rows) {
				if (!completedSlugs.has(r.slug)) {
					unmet.push({ id: r.id, slug: r.slug, title: r.title })
				}
			}

			if (unmet.length > 0) {
				res.status(409).json({
					error: "Prerequisites not met",
					unmetPrerequisites: unmet,
				})
				return
			}
		}

		// Insert enrollment record
		const versionResult = await pool.query(
			`SELECT COALESCE(MAX(l.version), 1)::int AS content_version
			 FROM lessons l
			 INNER JOIN courses c ON c.id = l.course_id
			 WHERE c.slug = $1 OR c.id::text = $1`,
			[course_id],
		)
		const contentVersion = Number(
			versionResult.rows[0]?.content_version ?? 1,
		)

		const result = await pool.query(
			`INSERT INTO enrollments (learner_address, course_id, tx_hash, content_version)
       VALUES ($1, $2, $3, $4)
       RETURNING id, enrolled_at, content_version`,
			[learner_address, course_id, tx_hash, contentVersion],
		)

		const enrollment = result.rows[0]

		res.status(201).json({
			enrollment_id: enrollment.id,
			enrolled_at: enrollment.enrolled_at,
			content_version: enrollment.content_version,
		})
	} catch (error) {
		log.error({ err: error }, "Error creating enrollment")
		res.status(500).json({
			error: "Failed to create enrollment",
		})
	}
}

/**
 * Get all enrollments for a learner.
 * Query param: learner_address
 */
export const getEnrollments = async (
	req: AuthRequest,
	res: Response,
): Promise<void> => {
	try {
		const { learner_address } = req.query

		if (!learner_address || typeof learner_address !== "string") {
			res.status(400).json({
				error: "learner_address query parameter is required",
			})
			return
		}

		const result = await pool.query(
			`SELECT id, learner_address, course_id, tx_hash, enrolled_at, content_version
       FROM enrollments
       WHERE learner_address = $1
       ORDER BY enrolled_at DESC`,
			[learner_address],
		)

		res.status(200).json({
			data: result.rows.map((row) => ({
				enrollment_id: row.id,
				course_id: row.course_id,
				tx_hash: row.tx_hash,
				enrolled_at: row.enrolled_at,
				content_version: row.content_version,
			})),
		})
	} catch (error) {
		log.error({ err: error }, "Error fetching enrollments")
		res.status(500).json({
			error: "Failed to fetch enrollments",
		})
	}
}
