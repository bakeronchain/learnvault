import { pool } from "./index"

export type NotificationType =
	| "milestone_approved"
	| "milestone_rejected"
	| "vote_result"
	| "disbursement"
	| "proposal_passed"

export interface Notification {
	id: number
	recipient_address: string
	type: NotificationType
	message: string
	href?: string | null
	data: Record<string, unknown>
	is_read: boolean
	created_at: string
}

export interface CreateNotificationInput {
	recipient_address: string
	type: NotificationType
	message: string
	href?: string | null
	data?: Record<string, unknown>
}

export interface PaginatedNotifications {
	notifications: Notification[]
	total: number
	unread_count: number
}

/**
 * Insert a single notification row.
 * Silently swallows errors so callers never need to worry about
 * a notification failure breaking the primary action.
 */
export async function createNotification(
	input: CreateNotificationInput,
): Promise<void> {
	try {
		await pool.query(
			`INSERT INTO notifications (recipient_address, type, message, href, data)
			 VALUES ($1, $2, $3, $4, $5)`,
			[
				input.recipient_address,
				input.type,
				input.message,
				input.href ?? null,
				JSON.stringify(input.data ?? {}),
			],
		)
	} catch (err) {
		console.error("[notifications-store] createNotification failed:", err)
	}
}

/**
 * Fetch paginated notifications for a user.
 * Unread notifications are returned first, then by created_at DESC.
 */
export async function getNotificationsForUser(
	recipientAddress: string,
	page: number,
	pageSize: number,
): Promise<PaginatedNotifications> {
	const offset = (page - 1) * pageSize

	const [countResult, rowsResult] = await Promise.all([
		pool.query(
			`SELECT
				COUNT(*)::int AS total,
				COUNT(*) FILTER (WHERE is_read = FALSE)::int AS unread_count
			 FROM notifications
			 WHERE recipient_address = $1`,
			[recipientAddress],
		),
		pool.query(
			`SELECT id, type, message, href, data, is_read, created_at
			 FROM notifications
			 WHERE recipient_address = $1
			 ORDER BY is_read ASC, created_at DESC
			 LIMIT $2 OFFSET $3`,
			[recipientAddress, pageSize, offset],
		),
	])

	return {
		notifications: rowsResult.rows,
		total: countResult.rows[0]?.total ?? 0,
		unread_count: countResult.rows[0]?.unread_count ?? 0,
	}
}

/**
 * Mark all unread notifications for a user as read.
 * Returns the number of rows updated.
 */
export async function markAllNotificationsRead(
	recipientAddress: string,
): Promise<number> {
	const result = await pool.query(
		`UPDATE notifications
		 SET is_read = TRUE
		 WHERE recipient_address = $1 AND is_read = FALSE
		 RETURNING id`,
		[recipientAddress],
	)
	return result.rowCount ?? 0
}

/**
 * Mark a single notification as read.
 * Returns true if the row was found and updated.
 */
export async function markNotificationRead(
	id: number,
	recipientAddress: string,
): Promise<boolean> {
	const result = await pool.query(
		`UPDATE notifications
		 SET is_read = TRUE
		 WHERE id = $1 AND recipient_address = $2
		 RETURNING id`,
		[id, recipientAddress],
	)
	return (result.rowCount ?? 0) > 0
}
