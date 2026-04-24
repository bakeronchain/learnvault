import { type Request, type Response } from "express"
import { flaggedContentStore } from "../db/flagged-content-store"
import { pool } from "../db/index"
import { createEmailService } from "../services/email.service"

const emailService = createEmailService(process.env.EMAIL_API_KEY || "")

interface FlagContentRequestBody {
	contentType: "comment" | "proposal"
	contentId: number
	reason: string
}

export async function flagContent(
	req: Request,
	res: Response,
): Promise<void> {
	const body = req.body as FlagContentRequestBody
	const { contentType, contentId, reason } = body

	if (!contentType || !contentId || !reason) {
		res.status(400).json({ error: "Missing required fields" })
		return
	}

	if (!["comment", "proposal"].includes(contentType)) {
		res.status(400).json({ error: "Invalid content type" })
		return
	}

	if (reason.length < 10) {
		res.status(400).json({ error: "Reason must be at least 10 characters" })
		return
	}

	const reporterAddress = (req.user as any)?.address

	if (!reporterAddress) {
		res.status(401).json({ error: "Authentication required" })
		return
	}

	try {
		// Verify content exists
		let contentExists = false
		if (contentType === "comment") {
			const result = await pool.query(
				`SELECT id FROM comments WHERE id = $1 AND deleted_at IS NULL`,
				[contentId],
			)
			contentExists = result.rows.length > 0
		} else if (contentType === "proposal") {
			const result = await pool.query(
				`SELECT id FROM proposals WHERE id = $1`,
				[contentId],
			)
			contentExists = result.rows.length > 0
		}

		if (!contentExists) {
			res.status(404).json({ error: "Content not found" })
			return
		}

		// Create or update flag
		const flag = await flaggedContentStore.createOrUpdateFlag(
			contentType,
			contentId,
			reporterAddress,
			reason,
		)

		// Check if content should be hidden (3+ flags)
		const flags = await flaggedContentStore.getFlagsForContent(
			contentType,
			contentId,
		)
		if (flags.length >= 3 && !flag.is_hidden) {
			await flaggedContentStore.deleteContent(contentType, contentId)
		}

		// Send email to admin
		emailService
			.sendAdminFlagNotification(contentType, contentId, reason, reporterAddress)
			.catch((err) => console.error("[EmailService] Admin flag alert failed:", err))

		res.status(201).json({ data: flag })
	} catch (err) {
		console.error("[flagContent] error:", err)
		res.status(500).json({ error: "Failed to flag content" })
	}
}
