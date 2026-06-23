import crypto from "crypto"
import { type Request, type Response } from "express"
import PDFDocument from "pdfkit"

import { pool } from "../db/index"
import { logger } from "../lib/logger"
import { type AuthRequest } from "../middleware/auth.middleware"

const log = logger.child({ module: "certificates" })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Collect all chunks written by a PDFDocument into a single Buffer.
 */
function collectPdfBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = []
		doc.on("data", (chunk: Buffer) => chunks.push(chunk))
		doc.on("end", () => resolve(Buffer.concat(chunks)))
		doc.on("error", reject)
	})
}

/**
 * Render the certificate PDF and return the raw bytes.
 */
function buildCertificatePdf(data: {
	learnerName: string
	courseTitle: string
	completionDate: string
	instructorName: string
	lrnEarned: string | number
	verificationId: string
}): Promise<Buffer> {
	const doc = new PDFDocument({ size: "A4", margin: 50 })
	const bufferPromise = collectPdfBuffer(doc)

	// Title
	doc
		.fontSize(36)
		.font("Helvetica-Bold")
		.text("Certificate of Completion", { align: "center" })

	doc.moveDown(0.5)
	doc
		.fontSize(12)
		.font("Helvetica")
		.text("This certifies that", { align: "center" })

	// Learner name
	doc.moveDown(0.3)
	doc
		.fontSize(24)
		.font("Helvetica-Bold")
		.text(data.learnerName, { align: "center" })

	// Body copy
	doc.moveDown(0.5)
	doc
		.fontSize(12)
		.font("Helvetica")
		.text("has successfully completed the course", { align: "center" })

	// Course title
	doc.moveDown(0.3)
	doc
		.fontSize(18)
		.font("Helvetica-Bold")
		.text(data.courseTitle, { align: "center" })

	// Metadata row
	doc.moveDown(0.8)
	doc
		.fontSize(11)
		.font("Helvetica")
		.text(`Completion Date: ${data.completionDate}`, { align: "center" })

	doc.moveDown(0.2)
	doc
		.fontSize(11)
		.font("Helvetica")
		.text(`Instructor: ${data.instructorName}`, { align: "center" })

	doc.moveDown(0.2)
	doc
		.fontSize(11)
		.font("Helvetica")
		.text(`LRN Earned: ${data.lrnEarned}`, { align: "center" })

	// Verification footer
	doc.moveDown(1.5)
	doc
		.fontSize(9)
		.font("Helvetica")
		.text(`Certificate ID: ${data.verificationId}`, { align: "center" })

	doc.end()
	return bufferPromise
}

// ---------------------------------------------------------------------------
// GET /courses/:courseId/certificate
// ---------------------------------------------------------------------------

/**
 * Generate and stream a PDF certificate for a completed course.
 *
 * Acceptance criteria:
 *  - 401 if the request is unauthenticated
 *  - 403 with progress summary if the course is not completed
 *  - 200 with idempotent PDF for a completed course (duplicate requests return
 *    the same certificate row; PDF is regenerated on-the-fly from stored data)
 *  - Certificate metadata (user_id, course_id, issued_at, pdf_hash) stored in
 *    the `certificates` table
 *  - PDF content is SHA-256 hashed and stored so it can be verified externally
 */
export async function generateCertificate(
	req: Request,
	res: Response,
): Promise<void> {
	try {
		const authReq = req as AuthRequest
		const userAddress = authReq.user?.address ?? authReq.walletAddress

		if (!userAddress) {
			res.status(401).json({ error: "Unauthorized" })
			return
		}

		const { courseId } = req.params
		if (!courseId || typeof courseId !== "string") {
			res.status(400).json({ error: "courseId is required" })
			return
		}

		// ------------------------------------------------------------------
		// 1. Fetch course metadata
		// ------------------------------------------------------------------
		const courseResult = await pool.query<{
			slug: string
			title: string
			lrn_reward: string
		}>(
			`SELECT slug, title, lrn_reward
			 FROM courses
			 WHERE slug = $1 OR id::text = $1
			 LIMIT 1`,
			[courseId],
		)

		if (courseResult.rows.length === 0) {
			res.status(404).json({ error: "Course not found" })
			return
		}

		const course = courseResult.rows[0]

		// ------------------------------------------------------------------
		// 2. Verify course completion — check enrollments + approved milestones
		// ------------------------------------------------------------------

		// Count total milestones required for this course
		const totalMilestonesResult = await pool.query<{ total: string }>(
			`SELECT COUNT(*) AS total
			 FROM milestones
			 WHERE course_id = (SELECT id FROM courses WHERE slug = $1 OR id::text = $1)`,
			[courseId],
		)
		const totalMilestones = Number(
			totalMilestonesResult.rows[0]?.total ?? 0,
		)

		// Count milestones the learner has had approved
		const approvedResult = await pool.query<{ approved: string }>(
			`SELECT COUNT(*) AS approved
			 FROM milestone_reports
			 WHERE scholar_address = $1
			   AND course_id = $2
			   AND status = 'approved'`,
			[userAddress, course.slug],
		)
		const approvedCount = Number(approvedResult.rows[0]?.approved ?? 0)

		const isCompleted = totalMilestones > 0 && approvedCount >= totalMilestones

		if (!isCompleted) {
			res.status(403).json({
				error: "Course not completed",
				progress: {
					milestones_total: totalMilestones,
					milestones_approved: approvedCount,
					milestones_remaining: Math.max(
						0,
						totalMilestones - approvedCount,
					),
					percent_complete:
						totalMilestones > 0
							? Math.floor((approvedCount / totalMilestones) * 100)
							: 0,
				},
			})
			return
		}

		// ------------------------------------------------------------------
		// 3. Fetch real completion date from the last milestone approval
		// ------------------------------------------------------------------
		const completionDateResult = await pool.query<{ completed_at: Date }>(
			`SELECT MAX(mal.decided_at) AS completed_at
			 FROM milestone_audit_log mal
			 INNER JOIN milestone_reports mr ON mr.id = mal.report_id
			 WHERE mr.scholar_address = $1
			   AND mr.course_id = $2
			   AND mal.decision = 'approved'`,
			[userAddress, course.slug],
		)
		const completionDate =
			completionDateResult.rows[0]?.completed_at ?? new Date()
		const completionDateStr = new Date(completionDate).toLocaleDateString(
			"en-US",
			{ year: "numeric", month: "long", day: "numeric" },
		)

		// ------------------------------------------------------------------
		// 4. Idempotency — return existing certificate record if present
		// ------------------------------------------------------------------
		const existingResult = await pool.query<{
			id: number
			issued_at: Date
			pdf_hash: string
		}>(
			`SELECT id, issued_at, pdf_hash
			 FROM certificates
			 WHERE user_id = $1 AND course_id = $2
			 LIMIT 1`,
			[userAddress, course.slug],
		)

		// Learner display name: use their wallet address, trimmed to keep the PDF tidy
		const learnerName = userAddress

		// Use a static instructor name (can be enriched from course data later)
		const instructorName = "LearnVault Platform"

		let certificateId: number
		let issuedAt: Date
		let pdfHash: string

		if (existingResult.rows.length > 0) {
			// Re-use stored metadata — regenerate PDF deterministically
			const existing = existingResult.rows[0]
			certificateId = existing.id
			issuedAt = new Date(existing.issued_at)
			pdfHash = existing.pdf_hash
		} else {
			// ------------------------------------------------------------------
			// 5. Generate the PDF and hash it
			// ------------------------------------------------------------------
			const verificationId = crypto.randomUUID()
			const pdfBuffer = await buildCertificatePdf({
				learnerName,
				courseTitle: course.title,
				completionDate: completionDateStr,
				instructorName,
				lrnEarned: course.lrn_reward ?? 0,
				verificationId,
			})

			pdfHash = crypto
				.createHash("sha256")
				.update(pdfBuffer)
				.digest("hex")

			// ------------------------------------------------------------------
			// 6. Persist certificate metadata
			// ------------------------------------------------------------------
			const insertResult = await pool.query<{ id: number; issued_at: Date }>(
				`INSERT INTO certificates (user_id, course_id, pdf_hash)
				 VALUES ($1, $2, $3)
				 ON CONFLICT (user_id, course_id) DO NOTHING
				 RETURNING id, issued_at`,
				[userAddress, course.slug, pdfHash],
			)

			if (insertResult.rows.length === 0) {
				// Race condition — another request inserted first; fetch that row
				const race = await pool.query<{
					id: number
					issued_at: Date
					pdf_hash: string
				}>(
					`SELECT id, issued_at, pdf_hash
					 FROM certificates
					 WHERE user_id = $1 AND course_id = $2`,
					[userAddress, course.slug],
				)
				const raceRow = race.rows[0]
				certificateId = raceRow.id
				issuedAt = new Date(raceRow.issued_at)
				pdfHash = raceRow.pdf_hash
			} else {
				certificateId = insertResult.rows[0].id
				issuedAt = new Date(insertResult.rows[0].issued_at)
			}

			// Stream the freshly generated PDF to the client
			res.setHeader("Content-Type", "application/pdf")
			res.setHeader(
				"Content-Disposition",
				`attachment; filename="certificate-${course.slug}.pdf"`,
			)
			res.setHeader("X-Certificate-Id", String(certificateId))
			res.setHeader("X-Certificate-Hash", pdfHash)
			res.setHeader("X-Issued-At", issuedAt.toISOString())
			res.send(pdfBuffer)
			return
		}

		// ------------------------------------------------------------------
		// 7. Regenerate the PDF for returning requests (same data, new bytes)
		// ------------------------------------------------------------------
		const verificationId = String(certificateId)
		const pdfBuffer = await buildCertificatePdf({
			learnerName,
			courseTitle: course.title,
			completionDate: completionDateStr,
			instructorName,
			lrnEarned: course.lrn_reward ?? 0,
			verificationId,
		})

		res.setHeader("Content-Type", "application/pdf")
		res.setHeader(
			"Content-Disposition",
			`attachment; filename="certificate-${course.slug}.pdf"`,
		)
		res.setHeader("X-Certificate-Id", String(certificateId))
		res.setHeader("X-Certificate-Hash", pdfHash)
		res.setHeader("X-Issued-At", issuedAt.toISOString())
		res.send(pdfBuffer)
	} catch (error) {
		log.error({ err: error }, "Certificate generation error")
		res.status(500).json({ error: "Failed to generate certificate" })
	}
}

// ---------------------------------------------------------------------------
// GET /certificates/:certificateId/verify
// ---------------------------------------------------------------------------

/**
 * Look up a certificate record and return its metadata for external verification.
 */
export async function verifyCertificate(
	req: Request,
	res: Response,
): Promise<void> {
	try {
		const { certificateId } = req.params

		const idNum = Number(certificateId)
		if (!certificateId || Number.isNaN(idNum) || idNum < 1) {
			res.status(400).json({ error: "Invalid certificateId" })
			return
		}

		const result = await pool.query<{
			id: number
			user_id: string
			course_id: string
			issued_at: Date
			pdf_hash: string
			pdf_url: string | null
			course_title: string
		}>(
			`SELECT c.id, c.user_id, c.course_id, c.issued_at, c.pdf_hash, c.pdf_url,
			        co.title AS course_title
			 FROM certificates c
			 JOIN courses co ON co.slug = c.course_id
			 WHERE c.id = $1`,
			[idNum],
		)

		if (result.rows.length === 0) {
			res.status(404).json({ error: "Certificate not found" })
			return
		}

		const row = result.rows[0]
		res.status(200).json({
			certificate_id: row.id,
			verified: true,
			user_id: row.user_id,
			course_id: row.course_id,
			course_title: row.course_title,
			issued_at: new Date(row.issued_at).toISOString(),
			pdf_hash: row.pdf_hash,
			pdf_url: row.pdf_url ?? null,
		})
	} catch (error) {
		log.error({ err: error }, "Certificate verification error")
		res.status(500).json({ error: "Verification failed" })
	}
}
