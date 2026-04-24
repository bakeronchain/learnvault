import { Router, type Response } from "express"
import { pool } from "../db/index"
import {
	adminModerationActionSchema,
	flagContentBodySchema,
} from "../lib/zod-schemas"
import {
	createRequireAuth,
	type AuthRequest,
} from "../middleware/auth.middleware"
import { requireAdmin, type AdminRequest } from "../middleware/admin.middleware"
import { validate } from "../middleware/validate.middleware"
import { createEmailService } from "../services/email.service"
import { type JwtService } from "../services/jwt.service"

const AUTO_HIDE_THRESHOLD = 3

export function createModerationRouter(jwtService: JwtService): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)
	const emailService = createEmailService()

	// -------------------------------------------------------------------------
	// POST /api/comments/:id/flag
	// Authenticated users can flag a comment with a reason.
	// Auto-hides the comment when flag_count reaches AUTO_HIDE_THRESHOLD.
	// Emails admins on every new flag.
	// -------------------------------------------------------------------------

	/**
	 * @openapi
	 * /api/comments/{id}/flag:
	 *   post:
	 *     summary: Flag a comment for moderation
	 *     tags: [Moderation]
	 *     security: [{ bearerAuth: [] }]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema: { type: integer }
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required: [reason]
	 *             properties:
	 *               reason:
	 *                 type: string
	 *                 maxLength: 500
	 *     responses:
	 *       201:
	 *         description: Flag recorded
	 *       409:
	 *         description: Already flagged by this user
	 */
	router.post(
		"/comments/:id/flag",
		requireAuth,
		validate({ body: flagContentBodySchema }),
		async (req: AuthRequest, res: Response) => {
			const commentId = parseInt(req.params.id, 10)
			if (!Number.isFinite(commentId) || commentId <= 0) {
				return res.status(400).json({ error: "Invalid comment id" })
			}

			const reporter = req.user?.address ?? ""
			const { reason } = req.body as { reason: string }

			const client = await pool.connect()
			try {
				await client.query("BEGIN")

				// Verify comment exists and is not deleted
				const commentRes = await client.query(
					`SELECT id, author_address, flag_count FROM comments WHERE id = $1 AND deleted_at IS NULL`,
					[commentId],
				)
				if (commentRes.rows.length === 0) {
					await client.query("ROLLBACK")
					return res.status(404).json({ error: "Comment not found" })
				}

				// Prevent self-flagging
				if (commentRes.rows[0].author_address === reporter) {
					await client.query("ROLLBACK")
					return res
						.status(400)
						.json({ error: "You cannot flag your own comment" })
				}

				// Insert flag (unique constraint prevents duplicates)
				try {
					await client.query(
						`INSERT INTO flagged_content (content_type, content_id, reporter, reason)
             VALUES ('comment', $1, $2, $3)`,
						[commentId, reporter, reason],
					)
				} catch (err: unknown) {
					// Unique violation — already flagged by this reporter
					if (
						typeof err === "object" &&
						err !== null &&
						"code" in err &&
						(err as { code: string }).code === "23505"
					) {
						await client.query("ROLLBACK")
						return res
							.status(409)
							.json({ error: "You have already flagged this comment" })
					}
					throw err
				}

				// Increment flag_count on the comment
				const updatedComment = await client.query(
					`UPDATE comments SET flag_count = flag_count + 1 WHERE id = $1 RETURNING flag_count`,
					[commentId],
				)
				const newFlagCount: number = updatedComment.rows[0].flag_count

				// Auto-hide when threshold reached
				if (newFlagCount >= AUTO_HIDE_THRESHOLD) {
					await client.query(
						`UPDATE comments SET hidden_at = CURRENT_TIMESTAMP WHERE id = $1 AND hidden_at IS NULL`,
						[commentId],
					)
				}

				await client.query("COMMIT")

				// Fire-and-forget admin email notification
				void emailService
					.sendAdminFlagNotification({
						contentType: "comment",
						contentId: commentId,
						reporter,
						reason,
						flagCount: newFlagCount,
					})
					.catch((err) =>
						console.error("[moderation] Failed to send flag email:", err),
					)

				return res.status(201).json({
					success: true,
					flagCount: newFlagCount,
					autoHidden: newFlagCount >= AUTO_HIDE_THRESHOLD,
				})
			} catch (err) {
				await client.query("ROLLBACK")
				console.error("[moderation] flag error:", err)
				return res.status(500).json({ error: "Failed to flag comment" })
			} finally {
				client.release()
			}
		},
	)

	// -------------------------------------------------------------------------
	// GET /api/admin/moderation
	// Returns paginated list of flagged content with pending status.
	// -------------------------------------------------------------------------

	/**
	 * @openapi
	 * /api/admin/moderation:
	 *   get:
	 *     summary: Get flagged content queue
	 *     tags: [Admin, Moderation]
	 *     security: [{ bearerAuth: [] }]
	 *     parameters:
	 *       - in: query
	 *         name: status
	 *         schema: { type: string, enum: [pending, dismissed, actioned] }
	 *       - in: query
	 *         name: page
	 *         schema: { type: integer }
	 *       - in: query
	 *         name: pageSize
	 *         schema: { type: integer }
	 *     responses:
	 *       200:
	 *         description: Paginated flagged content list
	 */
	router.get(
		"/admin/moderation",
		requireAdmin,
		async (req: AdminRequest, res: Response) => {
			const status = (req.query.status as string) || "pending"
			const page = Math.max(1, parseInt(req.query.page as string) || 1)
			const pageSize = Math.min(
				50,
				Math.max(1, parseInt(req.query.pageSize as string) || 20),
			)
			const offset = (page - 1) * pageSize

			const validStatuses = ["pending", "dismissed", "actioned"]
			if (!validStatuses.includes(status)) {
				return res.status(400).json({ error: "Invalid status filter" })
			}

			try {
				const countRes = await pool.query(
					`SELECT COUNT(*) FROM flagged_content WHERE status = $1`,
					[status],
				)
				const total = parseInt(countRes.rows[0].count, 10)

				const flagsRes = await pool.query(
					`SELECT
            fc.id,
            fc.content_type,
            fc.content_id,
            fc.reporter,
            fc.reason,
            fc.status,
            fc.created_at,
            fc.resolved_at,
            fc.resolved_by,
            c.content        AS comment_content,
            c.author_address AS comment_author,
            c.flag_count,
            c.hidden_at      IS NOT NULL AS is_hidden
          FROM flagged_content fc
          LEFT JOIN comments c
            ON fc.content_type = 'comment' AND fc.content_id = c.id
          WHERE fc.status = $1
          ORDER BY fc.created_at DESC
          LIMIT $2 OFFSET $3`,
					[status, pageSize, offset],
				)

				return res.json({
					data: flagsRes.rows,
					total,
					page,
					pageSize,
				})
			} catch (err) {
				console.error("[moderation] fetch queue error:", err)
				return res.status(500).json({ error: "Failed to fetch moderation queue" })
			}
		},
	)

	// -------------------------------------------------------------------------
	// POST /api/admin/moderation/:flagId/action
	// Admin actions: delete content, dismiss flag, or warn user.
	// -------------------------------------------------------------------------

	/**
	 * @openapi
	 * /api/admin/moderation/{flagId}/action:
	 *   post:
	 *     summary: Take moderation action on a flagged item
	 *     tags: [Admin, Moderation]
	 *     security: [{ bearerAuth: [] }]
	 *     parameters:
	 *       - in: path
	 *         name: flagId
	 *         required: true
	 *         schema: { type: integer }
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required: [action]
	 *             properties:
	 *               action:
	 *                 type: string
	 *                 enum: [delete, dismiss, warn]
	 *               warn_reason:
	 *                 type: string
	 *     responses:
	 *       200:
	 *         description: Action applied
	 */
	router.post(
		"/admin/moderation/:flagId/action",
		requireAdmin,
		validate({ body: adminModerationActionSchema }),
		async (req: AdminRequest, res: Response) => {
			const flagId = parseInt(req.params.flagId, 10)
			if (!Number.isFinite(flagId) || flagId <= 0) {
				return res.status(400).json({ error: "Invalid flag id" })
			}

			const { action, warn_reason } = req.body as {
				action: "delete" | "dismiss" | "warn"
				warn_reason?: string
			}
			const adminAddress = req.adminAddress ?? "admin"

			const client = await pool.connect()
			try {
				await client.query("BEGIN")

				// Fetch the flag
				const flagRes = await client.query(
					`SELECT * FROM flagged_content WHERE id = $1`,
					[flagId],
				)
				if (flagRes.rows.length === 0) {
					await client.query("ROLLBACK")
					return res.status(404).json({ error: "Flag not found" })
				}

				const flag = flagRes.rows[0] as {
					id: number
					content_type: string
					content_id: number
					reporter: string
					status: string
				}

				if (flag.status !== "pending") {
					await client.query("ROLLBACK")
					return res
						.status(409)
						.json({ error: "Flag has already been resolved" })
				}

				if (action === "delete") {
					// Soft-delete the comment and mark all its flags as actioned
					await client.query(
						`UPDATE comments SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL`,
						[flag.content_id],
					)
					await client.query(
						`UPDATE flagged_content
             SET status = 'actioned', resolved_at = CURRENT_TIMESTAMP, resolved_by = $1
             WHERE content_type = $2 AND content_id = $3 AND status = 'pending'`,
						[adminAddress, flag.content_type, flag.content_id],
					)
				} else if (action === "dismiss") {
					// Dismiss this specific flag and un-hide the content if no other pending flags remain
					await client.query(
						`UPDATE flagged_content
             SET status = 'dismissed', resolved_at = CURRENT_TIMESTAMP, resolved_by = $1
             WHERE id = $2`,
						[adminAddress, flagId],
					)

					// Check if any pending flags remain for this content
					const remainingRes = await client.query(
						`SELECT COUNT(*) FROM flagged_content
             WHERE content_type = $1 AND content_id = $2 AND status = 'pending'`,
						[flag.content_type, flag.content_id],
					)
					if (parseInt(remainingRes.rows[0].count, 10) === 0) {
						// Restore visibility
						await client.query(
							`UPDATE comments SET hidden_at = NULL WHERE id = $1`,
							[flag.content_id],
						)
					}
				} else if (action === "warn") {
					// Dismiss the flag and send a warning email to the content author
					await client.query(
						`UPDATE flagged_content
             SET status = 'actioned', resolved_at = CURRENT_TIMESTAMP, resolved_by = $1
             WHERE id = $2`,
						[adminAddress, flagId],
					)

					// Fetch the author's address to use as the "to" address
					// (In this project, wallet addresses are used as identifiers — no email stored)
					// We log the warning; if an email lookup service is added later, wire it here.
					const authorRes = await client.query(
						`SELECT author_address FROM comments WHERE id = $1`,
						[flag.content_id],
					)
					if (authorRes.rows.length > 0) {
						const authorAddress: string = authorRes.rows[0].author_address
						// Fire-and-forget — only succeeds if the address happens to be an email
						// or if a future user-email mapping is added.
						void emailService
							.sendUserWarnNotification({
								to: authorAddress,
								contentType: flag.content_type,
								reason: warn_reason,
							})
							.catch((err) =>
								console.warn("[moderation] warn email skipped:", err),
							)
					}
				}

				await client.query("COMMIT")
				return res.json({ success: true, action })
			} catch (err) {
				await client.query("ROLLBACK")
				console.error("[moderation] action error:", err)
				return res.status(500).json({ error: "Failed to apply moderation action" })
			} finally {
				client.release()
			}
		},
	)

	return router
}
