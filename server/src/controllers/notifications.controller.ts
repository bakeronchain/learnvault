import { type Request, type Response } from "express"

import {
	getNotificationsForUser,
	getNotificationPreferences,
	removePushSubscription,
	type NotificationPreferences,
	markAllNotificationsRead,
	markNotificationRead,
	updateNotificationPreferences,
	upsertPushSubscription,
} from "../db/notifications-store"
import { type AuthRequest } from "../middleware/auth.middleware"

function parsePositiveInt(value: unknown, fallback: number): number {
	if (typeof value !== "string") return fallback
	const parsed = Number.parseInt(value, 10)
	if (Number.isNaN(parsed) || parsed < 1) return fallback
	return parsed
}

/**
 * GET /api/notifications
 * Returns paginated notifications for the authenticated user.
 * Unread notifications are returned first, then by created_at DESC.
 *
 * Query params:
 *   page     – page number (default: 1)
 *   pageSize – items per page (default: 20, max: 100)
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

	const page = parsePositiveInt(req.query.page, 1)
	const pageSize = Math.min(parsePositiveInt(req.query.pageSize, 20), 100)

	try {
		const result = await getNotificationsForUser(address, page, pageSize)

		res.status(200).json({
			notifications: result.notifications,
			unread_count: result.unread_count,
			total: result.total,
			page,
			pageSize,
			totalPages: Math.ceil(result.total / pageSize),
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
		const updated = await markAllNotificationsRead(address)
		res.status(200).json({ updated })
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
		const found = await markNotificationRead(id, address)
		if (!found) {
			res.status(404).json({ error: "Notification not found" })
			return
		}
		res.status(200).json({ updated: 1 })
	} catch (err) {
		console.error("[notifications] markOneRead error:", err)
		res.status(500).json({ error: "Failed to mark notification as read" })
	}
}

/**
 * PUT /api/notifications/read
 * Bulk-mark a list of notification IDs as read.
 * Body: { ids: number[] }
 */
export async function markManyRead(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const address = req.user?.address
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const { ids } = req.body as { ids?: unknown }
	if (
		!Array.isArray(ids) ||
		ids.length === 0 ||
		ids.some((id) => !Number.isInteger(id) || id <= 0)
	) {
		res
			.status(400)
			.json({ error: "ids must be a non-empty array of positive integers" })
		return
	}

	try {
		// Mark each in parallel; ignore individual failures
		const results = await Promise.allSettled(
			(ids as number[]).map((id) => markNotificationRead(id, address)),
		)
		const updated = results.filter(
			(r) => r.status === "fulfilled" && r.value,
		).length
		res.status(200).json({ updated })
	} catch (err) {
		console.error("[notifications] markManyRead error:", err)
		res.status(500).json({ error: "Failed to mark notifications as read" })
	}
}

const ALLOWED_PREFERENCE_KEYS: Array<keyof NotificationPreferences> = [
	"milestone_approved",
	"milestone_rejected",
	"vote_result",
	"disbursement",
	"voting_deadline_reminder",
	"email_milestone_approved",
	"email_milestone_rejected",
	"email_vote_result",
	"email_disbursement",
	"email_voting_deadline_reminder",
	"quiet_hours_start",
	"quiet_hours_end",
	"quiet_hours_timezone",
]

export async function subscribePush(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const address = req.user?.address
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const { endpoint, keys } = req.body as {
		endpoint?: unknown
		keys?: { p256dh?: unknown; auth?: unknown }
	}
	if (
		typeof endpoint !== "string" ||
		!endpoint ||
		typeof keys?.p256dh !== "string" ||
		typeof keys?.auth !== "string"
	) {
		res.status(400).json({ error: "Invalid push subscription payload" })
		return
	}

	try {
		await upsertPushSubscription(address, {
			endpoint,
			keys: { p256dh: keys.p256dh, auth: keys.auth },
		})
		res.status(201).json({ success: true })
	} catch (err) {
		console.error("[notifications] subscribePush error:", err)
		res.status(500).json({ error: "Failed to save push subscription" })
	}
}

export async function unsubscribePush(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const address = req.user?.address
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}
	const { endpoint } = req.body as { endpoint?: unknown }
	if (typeof endpoint !== "string" || !endpoint) {
		res.status(400).json({ error: "Invalid endpoint" })
		return
	}
	try {
		const removed = await removePushSubscription(address, endpoint)
		res.status(200).json({ removed })
	} catch (err) {
		console.error("[notifications] unsubscribePush error:", err)
		res.status(500).json({ error: "Failed to remove push subscription" })
	}
}

export async function getPreferences(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const address = req.user?.address
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}
	try {
		const preferences = await getNotificationPreferences(address)
		res.status(200).json({ preferences })
	} catch (err) {
		console.error("[notifications] getPreferences error:", err)
		res.status(500).json({ error: "Failed to load notification preferences" })
	}
}

export async function updatePreferences(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const address = req.user?.address
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}
	const payload = req.body as Record<string, unknown>
	const updates: Partial<NotificationPreferences> = {}
	for (const key of ALLOWED_PREFERENCE_KEYS) {
		if (!(key in payload)) continue
		updates[key] = payload[key] as never
	}
	try {
		const preferences = await updateNotificationPreferences(address, updates)
		res.status(200).json({ preferences })
	} catch (err) {
		console.error("[notifications] updatePreferences error:", err)
		res.status(500).json({ error: "Failed to update notification preferences" })
	}
}
