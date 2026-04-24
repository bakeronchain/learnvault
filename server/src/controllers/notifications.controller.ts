import { type Request, type Response } from "express"

import { pool } from "../db/index"
import { type AuthRequest } from "../middleware/auth.middleware"

/**
 * GET /api/notifications
 * Returns notifications for the authenticated user, newest first.
 */
export async function getNotifications(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const address = req.user?.address
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	try {
		const result = await pool.query(
			`SELECT id, type, message, href, is_read, created_at
			 FROM notifications
			 WHERE recipient_address = $1
			 ORDER BY created_at DESC
			 LIMIT 50`,
			[address],
		)

		const unreadCount = result.rows.filter((r) => !r.is_read).length

		res.status(200).json({
			notifications: result.rows,
			unread_count: unreadCount,
		})
	} catch (err) {
		console.error("[notifications] getNotifications error:", err)
		res.status(500).json({ error: "Failed to fetch notifications" })
	}
}

/**
 * PATCH /api/notifications/read-all
 * Marks all notifications for the authenticated user as read.
 */
export async function markAllRead(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const address = req.user?.address
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	try {
		const result = await pool.query(
			`UPDATE notifications
			 SET is_read = TRUE
			 WHERE recipient_address = $1 AND is_read = FALSE
			 RETURNING id`,
			[address],
		)

		res.status(200).json({ updated: result.rowCount ?? 0 })
	} catch (err) {
		console.error("[notifications] markAllRead error:", err)
		res.status(500).json({ error: "Failed to mark notifications as read" })
	}
}

/**
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read.
 */
export async function markOneRead(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const address = req.user?.address
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const id = Number(req.params.id)
	if (!Number.isInteger(id) || id <= 0) {
		res.status(400).json({ error: "Invalid notification id" })
		return
	}

	try {
		const result = await pool.query(
			`UPDATE notifications
			 SET is_read = TRUE
			 WHERE id = $1 AND recipient_address = $2
			 RETURNING id`,
			[id, address],
		)

		if ((result.rowCount ?? 0) === 0) {
			res.status(404).json({ error: "Notification not found" })
			return
		}

		res.status(200).json({ updated: 1 })
	} catch (err) {
		console.error("[notifications] markOneRead error:", err)
		res.status(500).json({ error: "Failed to mark notification as read" })
	}
}
