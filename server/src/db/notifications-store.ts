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

export interface PushSubscriptionInput {
	endpoint: string
	keys: {
		p256dh: string
		auth: string
	}
}

export interface NotificationPreferences {
	milestone_approved: boolean
	milestone_rejected: boolean
	vote_result: boolean
	disbursement: boolean
	email_milestone_approved: boolean
	email_milestone_rejected: boolean
	email_vote_result: boolean
	email_disbursement: boolean
	quiet_hours_start: string | null
	quiet_hours_end: string | null
	quiet_hours_timezone: string | null
}

export async function recordNotificationDelivery(
	recipientAddress: string,
	notificationType: NotificationType,
	channel: "push" | "email",
	status: "sent" | "skipped" | "failed",
	details: Record<string, unknown> = {},
): Promise<void> {
	try {
		await pool.query(
			`INSERT INTO notification_delivery_log (
				recipient_address, notification_type, channel, status, details
			)
			VALUES ($1, $2, $3, $4, $5)`,
			[
				recipientAddress,
				notificationType,
				channel,
				status,
				JSON.stringify(details),
			],
		)
	} catch (err) {
		console.error("[notifications-store] recordNotificationDelivery failed:", err)
	}
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

export async function upsertPushSubscription(
	recipientAddress: string,
	subscription: PushSubscriptionInput,
): Promise<void> {
	await pool.query(
		`INSERT INTO notification_push_subscriptions (
			recipient_address,
			endpoint,
			p256dh,
			auth
		)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (recipient_address, endpoint)
		DO UPDATE SET
			p256dh = EXCLUDED.p256dh,
			auth = EXCLUDED.auth,
			updated_at = CURRENT_TIMESTAMP`,
		[
			recipientAddress,
			subscription.endpoint,
			subscription.keys.p256dh,
			subscription.keys.auth,
		],
	)
}

export async function getPushSubscriptions(recipientAddress: string): Promise<
	Array<{ endpoint: string; keys: { p256dh: string; auth: string } }>
> {
	const result = await pool.query(
		`SELECT endpoint, p256dh, auth
		 FROM notification_push_subscriptions
		 WHERE recipient_address = $1`,
		[recipientAddress],
	)
	return result.rows.map((row) => ({
		endpoint: row.endpoint,
		keys: {
			p256dh: row.p256dh,
			auth: row.auth,
		},
	}))
}

export async function removePushSubscription(
	recipientAddress: string,
	endpoint: string,
): Promise<number> {
	const result = await pool.query(
		`DELETE FROM notification_push_subscriptions
		 WHERE recipient_address = $1 AND endpoint = $2`,
		[recipientAddress, endpoint],
	)
	return result.rowCount ?? 0
}

export async function getNotificationPreferences(
	recipientAddress: string,
): Promise<NotificationPreferences> {
	const result = await pool.query(
		`SELECT
			milestone_approved,
			milestone_rejected,
			vote_result,
			disbursement,
			email_milestone_approved,
			email_milestone_rejected,
			email_vote_result,
			email_disbursement,
			quiet_hours_start,
			quiet_hours_end,
			quiet_hours_timezone
		 FROM notification_preferences
		 WHERE recipient_address = $1`,
		[recipientAddress],
	)
	if (result.rows[0]) {
		return result.rows[0] as NotificationPreferences
	}
	const insertResult = await pool.query(
		`INSERT INTO notification_preferences (recipient_address)
		 VALUES ($1)
		 RETURNING
			milestone_approved,
			milestone_rejected,
			vote_result,
			disbursement,
			email_milestone_approved,
			email_milestone_rejected,
			email_vote_result,
			email_disbursement,
			quiet_hours_start,
			quiet_hours_end,
			quiet_hours_timezone`,
		[recipientAddress],
	)
	return insertResult.rows[0] as NotificationPreferences
}

export async function updateNotificationPreferences(
	recipientAddress: string,
	updates: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
	await getNotificationPreferences(recipientAddress)
	const fields = Object.entries(updates).filter(([, value]) => value !== undefined)
	if (fields.length === 0) {
		return getNotificationPreferences(recipientAddress)
	}
	const sets = fields.map(([field], idx) => `${field} = $${idx + 2}`)
	const values = fields.map(([, value]) => value)
	const result = await pool.query(
		`UPDATE notification_preferences
		 SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
		 WHERE recipient_address = $1
		 RETURNING
			milestone_approved,
			milestone_rejected,
			vote_result,
			disbursement,
			email_milestone_approved,
			email_milestone_rejected,
			email_vote_result,
			email_disbursement,
			quiet_hours_start,
			quiet_hours_end,
			quiet_hours_timezone`,
		[recipientAddress, ...values],
	)
	return result.rows[0] as NotificationPreferences
}
