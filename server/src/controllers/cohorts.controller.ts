import { type Response } from "express"
import { pool } from "../db/index"
import { logger } from "../lib/logger"
import { type AuthRequest } from "../middleware/auth.middleware"

const log = logger.child({ module: "cohorts" })

/**
 * Create a new study cohort for a course.
 * The creator is automatically added as the first member.
 */
export const createCohort = async (
	req: AuthRequest,
	res: Response,
): Promise<void> => {
	try {
		const walletAddress = req.walletAddress
		if (!walletAddress) {
			res.status(401).json({ error: "Unauthorized" })
			return
		}

		const { name, course_slug, start_date, max_members } = req.body

		const courseResult = await pool.query(
			`SELECT slug FROM courses WHERE slug = $1 LIMIT 1`,
			[course_slug],
		)
		if (courseResult.rows.length === 0) {
			res.status(404).json({ error: "Course not found" })
			return
		}

		const client = await pool.connect()
		try {
			await client.query("BEGIN")

			const cohortResult = await client.query(
				`INSERT INTO cohorts (name, course_slug, start_date, max_members, created_by)
				 VALUES ($1, $2, $3, $4, $5)
				 RETURNING id, name, course_slug, start_date, max_members, created_by, created_at`,
				[name, course_slug, start_date, max_members ?? 8, walletAddress],
			)
			const cohort = cohortResult.rows[0]

			await client.query(
				`INSERT INTO cohort_members (cohort_id, learner_addr) VALUES ($1, $2)`,
				[cohort.id, walletAddress],
			)

			await client.query("COMMIT")

			res.status(201).json({ ...cohort, member_count: 1 })
		} catch (error) {
			await client.query("ROLLBACK")
			throw error
		} finally {
			client.release()
		}
	} catch (error) {
		log.error({ err: error }, "Error creating cohort")
		res.status(500).json({ error: "Failed to create cohort" })
	}
}

/**
 * List cohorts, optionally filtered by course slug.
 * Includes current member count so clients can show joinable capacity.
 */
export const listCohorts = async (
	req: AuthRequest,
	res: Response,
): Promise<void> => {
	try {
		const { course } = req.query

		const params: string[] = []
		let whereClause = ""
		if (course && typeof course === "string") {
			params.push(course)
			whereClause = "WHERE c.course_slug = $1"
		}

		const result = await pool.query(
			`SELECT c.id, c.name, c.course_slug, c.start_date, c.max_members,
			        c.created_by, c.created_at,
			        COUNT(cm.learner_addr)::int AS member_count
			 FROM cohorts c
			 LEFT JOIN cohort_members cm ON cm.cohort_id = c.id
			 ${whereClause}
			 GROUP BY c.id
			 ORDER BY c.start_date ASC, c.created_at ASC`,
			params,
		)

		res.status(200).json({ data: result.rows })
	} catch (error) {
		log.error({ err: error }, "Error listing cohorts")
		res.status(500).json({ error: "Failed to list cohorts" })
	}
}

/**
 * Join a cohort. Capacity-checked inside a transaction (the cohort row is
 * locked to serialize concurrent joins). Idempotent: joining a cohort you
 * are already a member of succeeds without duplicating membership.
 */
export const joinCohort = async (
	req: AuthRequest,
	res: Response,
): Promise<void> => {
	try {
		const walletAddress = req.walletAddress
		if (!walletAddress) {
			res.status(401).json({ error: "Unauthorized" })
			return
		}

		const cohortId = parseInt(req.params.id, 10)

		const client = await pool.connect()
		try {
			await client.query("BEGIN")

			const cohortResult = await client.query(
				`SELECT id, max_members FROM cohorts WHERE id = $1 FOR UPDATE`,
				[cohortId],
			)
			if (cohortResult.rows.length === 0) {
				await client.query("ROLLBACK")
				res.status(404).json({ error: "Cohort not found" })
				return
			}
			const cohort = cohortResult.rows[0]

			const memberResult = await client.query(
				`SELECT learner_addr FROM cohort_members WHERE cohort_id = $1`,
				[cohortId],
			)
			const members = memberResult.rows as Array<{ learner_addr: string }>

			if (members.some((m) => m.learner_addr === walletAddress)) {
				await client.query("ROLLBACK")
				res.status(200).json({
					joined: true,
					already_member: true,
					member_count: members.length,
				})
				return
			}

			if (members.length >= cohort.max_members) {
				await client.query("ROLLBACK")
				res.status(409).json({ error: "Cohort is full" })
				return
			}

			await client.query(
				`INSERT INTO cohort_members (cohort_id, learner_addr)
				 VALUES ($1, $2)
				 ON CONFLICT (cohort_id, learner_addr) DO NOTHING`,
				[cohortId, walletAddress],
			)

			await client.query("COMMIT")

			res.status(200).json({
				joined: true,
				already_member: false,
				member_count: members.length + 1,
			})
		} catch (error) {
			await client.query("ROLLBACK")
			throw error
		} finally {
			client.release()
		}
	} catch (error) {
		log.error({ err: error }, "Error joining cohort")
		res.status(500).json({ error: "Failed to join cohort" })
	}
}

/**
 * Leave a cohort. Idempotent: leaving a cohort you are not a member of
 * succeeds as a no-op.
 */
export const leaveCohort = async (
	req: AuthRequest,
	res: Response,
): Promise<void> => {
	try {
		const walletAddress = req.walletAddress
		if (!walletAddress) {
			res.status(401).json({ error: "Unauthorized" })
			return
		}

		const cohortId = parseInt(req.params.id, 10)

		const cohortResult = await pool.query(
			`SELECT id FROM cohorts WHERE id = $1`,
			[cohortId],
		)
		if (cohortResult.rows.length === 0) {
			res.status(404).json({ error: "Cohort not found" })
			return
		}

		const result = await pool.query(
			`DELETE FROM cohort_members WHERE cohort_id = $1 AND learner_addr = $2`,
			[cohortId, walletAddress],
		)

		res.status(200).json({
			left: true,
			was_member: (result.rowCount ?? 0) > 0,
		})
	} catch (error) {
		log.error({ err: error }, "Error leaving cohort")
		res.status(500).json({ error: "Failed to leave cohort" })
	}
}

/**
 * Cohort detail: members with per-member approved-milestone progress
 * (joined against milestone_reports) plus a group completion percentage.
 * Members are ordered by milestones completed, so the payload doubles as
 * the group leaderboard.
 */
export const getCohortDetail = async (
	req: AuthRequest,
	res: Response,
): Promise<void> => {
	try {
		const cohortId = parseInt(req.params.id, 10)

		const cohortResult = await pool.query(
			`SELECT id, name, course_slug, start_date, max_members, created_by, created_at
			 FROM cohorts WHERE id = $1`,
			[cohortId],
		)
		if (cohortResult.rows.length === 0) {
			res.status(404).json({ error: "Cohort not found" })
			return
		}
		const cohort = cohortResult.rows[0]

		const totalResult = await pool.query(
			`SELECT
			   (SELECT COUNT(*)::int FROM milestones m
			      INNER JOIN courses c ON c.id = m.course_id
			      WHERE c.slug = $1) AS milestone_count,
			   (SELECT COUNT(*)::int FROM lessons l
			      INNER JOIN courses c ON c.id = l.course_id
			      WHERE c.slug = $1) AS lesson_count`,
			[cohort.course_slug],
		)
		const totals = totalResult.rows[0] ?? {}
		// Some courses only track progress at the lesson level; fall back so
		// the completion percentage stays meaningful for them.
		const totalMilestones =
			Number(totals.milestone_count) > 0
				? Number(totals.milestone_count)
				: Number(totals.lesson_count ?? 0)

		const membersResult = await pool.query(
			`SELECT cm.learner_addr, cm.joined_at,
			        COUNT(mr.id) FILTER (WHERE mr.status = 'approved')::int AS milestones_completed
			 FROM cohort_members cm
			 LEFT JOIN milestone_reports mr
			   ON mr.scholar_address = cm.learner_addr
			  AND mr.course_id = $2
			 WHERE cm.cohort_id = $1
			 GROUP BY cm.learner_addr, cm.joined_at
			 ORDER BY milestones_completed DESC, cm.joined_at ASC`,
			[cohortId, cohort.course_slug],
		)

		const members = membersResult.rows.map(
			(row: {
				learner_addr: string
				joined_at: string
				milestones_completed: number
			}) => ({
				learner_addr: row.learner_addr,
				joined_at: row.joined_at,
				milestones_completed: Number(row.milestones_completed),
				total_milestones: totalMilestones,
			}),
		)

		const completedSum = members.reduce(
			(sum, m) => sum + m.milestones_completed,
			0,
		)
		const groupCompletionPct =
			members.length > 0 && totalMilestones > 0
				? Math.round((completedSum / (members.length * totalMilestones)) * 100)
				: 0

		res.status(200).json({
			...cohort,
			member_count: members.length,
			total_milestones: totalMilestones,
			group_completion_pct: groupCompletionPct,
			members,
		})
	} catch (error) {
		log.error({ err: error }, "Error fetching cohort detail")
		res.status(500).json({ error: "Failed to fetch cohort" })
	}
}
