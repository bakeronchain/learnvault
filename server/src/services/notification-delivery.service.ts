import {
	getNotificationPreferences,
	getPushSubscriptions,
	recordNotificationDelivery,
	type NotificationType,
} from "../db/notifications-store"
import { createEmailService } from "./email.service"

const emailService = createEmailService()

interface DeliverOptions {
	recipientAddress: string
	type: NotificationType
	title: string
	message: string
	href?: string
	email?: string | null
}

const EMAIL_PREF_MAP: Partial<
	Record<
		NotificationType,
		keyof Awaited<ReturnType<typeof getNotificationPreferences>>
	>
> = {
	milestone_approved: "email_milestone_approved",
	milestone_rejected: "email_milestone_rejected",
	vote_result: "email_vote_result",
	disbursement: "email_disbursement",
	voting_deadline_reminder: "email_voting_deadline_reminder",
}

function withinQuietHours(
	start: string | null,
	end: string | null,
	now: Date = new Date(),
): boolean {
	if (!start || !end) return false
	const [startHour = "0", startMinute = "0"] = start.split(":")
	const [endHour = "0", endMinute = "0"] = end.split(":")
	const current = now.getHours() * 60 + now.getMinutes()
	const startMinutes = Number(startHour) * 60 + Number(startMinute)
	const endMinutes = Number(endHour) * 60 + Number(endMinute)
	if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes)) return false
	if (startMinutes === endMinutes) return false
	if (startMinutes < endMinutes) {
		return current >= startMinutes && current < endMinutes
	}
	return current >= startMinutes || current < endMinutes
}

export async function deliverNotificationChannels(
	options: DeliverOptions,
): Promise<void> {
	try {
		const preferences = await getNotificationPreferences(
			options.recipientAddress,
		)
		if (!preferences[options.type]) {
			await recordNotificationDelivery(
				options.recipientAddress,
				options.type,
				"push",
				"skipped",
				{ reason: "push_disabled" },
			)
			return
		}

		if (
			withinQuietHours(
				preferences.quiet_hours_start,
				preferences.quiet_hours_end,
				new Date(),
			)
		) {
			await recordNotificationDelivery(
				options.recipientAddress,
				options.type,
				"push",
				"skipped",
				{ reason: "quiet_hours_active" },
			)
			return
		}

		const pushSubscriptions = await getPushSubscriptions(
			options.recipientAddress,
		)
		if (pushSubscriptions.length === 0) {
			await recordNotificationDelivery(
				options.recipientAddress,
				options.type,
				"push",
				"skipped",
				{ reason: "no_subscriptions" },
			)
		} else {
			await recordNotificationDelivery(
				options.recipientAddress,
				options.type,
				"push",
				"sent",
				{
					subscription_count: pushSubscriptions.length,
					payload: {
						title: options.title,
						message: options.message,
						href: options.href ?? null,
					},
				},
			)
		}

		const emailPrefKey = EMAIL_PREF_MAP[options.type]
		if (!emailPrefKey || !options.email || !preferences[emailPrefKey]) {
			await recordNotificationDelivery(
				options.recipientAddress,
				options.type,
				"email",
				"skipped",
				{ reason: "email_disabled_or_missing" },
			)
			return
		}

		const sent = await emailService.sendNotification({
			to: options.email,
			subject: options.title,
			template: "general-notification",
			data: {
				name: options.recipientAddress.slice(0, 8),
				body: options.message,
				actionUrl:
					options.href ?? `${process.env.FRONTEND_URL || ""}/dashboard`,
				unsubscribeUrl: "#",
			},
		})

		await recordNotificationDelivery(
			options.recipientAddress,
			options.type,
			"email",
			sent ? "sent" : "failed",
		)
	} catch (err) {
		console.error(
			"[notification-delivery] deliverNotificationChannels error:",
			err,
		)
	}
}
