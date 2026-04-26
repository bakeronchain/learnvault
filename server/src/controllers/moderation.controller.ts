import { type Request, type Response } from "express"
import { flaggedContentStore } from "../db/flagged-content-store"
import { pool } from "../db/index"

interface ModerationActionRequest {
	action: "delete" | "dismiss" | "warn"
	adminNotes?: string
}

export async function listFlaggedContent(
	req: Request,
	res: Response,
): Promise<void> {
	try {
		const status = (req.query.status as string) || "pending"
		const flags = await flaggedContentStore.getFlaggedContent(
			status as "pending" | "reviewed" | "dismissed",
		)

		res.json({ data: flags })
	} catch (err) {
		console.error("[listFlaggedContent] error:", err)
		res.status(500).json({ error: "Failed to fetch flagged content" })
	}
}

export async function getFlagDetails(
	req: Request,
	res: Response,
): Promise<void> {
	const { flagId } = req.params

	try {
		const flag = await flaggedContentStore.getFlagById(Number(flagId))
		if (!flag) {
			res.status(404).json({ error: "Flag not found" })
			return
		}

		// Get the actual content
		let content: any = null
		if (flag.content_type === "comment") {
			const result = await pool.query(
				`SELECT * FROM comments WHERE id = $1`,
				[flag.content_id],
			)
			content = result.rows[0]
		} else if (flag.content_type === "proposal") {
			const result = await pool.query(
				`SELECT * FROM proposals WHERE id = $1`,
				[flag.content_id],
			)
			content = result.rows[0]
		}

		// Get audit log
		const auditLog = await flaggedContentStore.getAuditForFlag(
			Number(flagId),
		)

		res.json({ data: { flag, content, auditLog } })
	} catch (err) {
		console.error("[getFlagDetails] error:", err)
		res.status(500).json({ error: "Failed to fetch flag details" })
	}
}

export async function actionOnFlag(
	req: Request,
	res: Response,
): Promise<void> {
	const { flagId } = req.params
	const body = req.body as ModerationActionRequest
	const adminAddress = (req as any).user?.address || (req as any).adminAddress

	const { action, adminNotes } = body

	if (!["delete", "dismiss", "warn"].includes(action)) {
		res.status(400).json({ error: "Invalid action" })
		return
	}

	try {
		const flag = await flaggedContentStore.getFlagById(Number(flagId))
		if (!flag) {
			res.status(404).json({ error: "Flag not found" })
			return
		}

		// Perform the action
		if (action === "delete") {
			// Soft delete the content
			if (flag.content_type === "comment") {
				await pool.query(
					`UPDATE comments SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`,
					[flag.content_id],
				)
			}
			// For proposals, we might want to archive them instead
		}

		// Update flag status
		const updatedFlag = await flaggedContentStore.updateFlagStatus(
			Number(flagId),
			"reviewed",
			adminAddress,
			action as "deleted" | "dismissed" | "warned",
			adminNotes,
		)

		// Add audit entry
		await flaggedContentStore.addAuditEntry(
			Number(flagId),
			action,
			adminAddress,
			adminNotes,
		)

		res.json({ data: updatedFlag })
	} catch (err) {
		console.error("[actionOnFlag] error:", err)
		res.status(500).json({ error: "Failed to take action on flag" })
	}
}

export async function getAdminModerationStats(
	req: Request,
	res: Response,
): Promise<void> {
	try {
		const pendingResult = await flaggedContentStore.getFlaggedContent("pending")
		const reviewedResult = await flaggedContentStore.getFlaggedContent("reviewed")

		const stats = {
			pendingCount: pendingResult.length,
			reviewedCount: reviewedResult.length,
			topReports: pendingResult.slice(0, 5),
		}

		res.json(stats)
	} catch (err) {
		console.error("[getAdminModerationStats] error:", err)
		res.status(500).json({ error: "Failed to fetch moderation stats" })
	}
}
