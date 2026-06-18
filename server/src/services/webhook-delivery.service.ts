import crypto from "crypto"
import { pool } from "../db"
import { logger } from "../lib/logger"

const log = logger.child({ module: "webhook-delivery" })

const MAX_ATTEMPTS = 3
const TIMEOUT_MS = 10_000

export type WebhookEventType =
	| "milestone.completed"
	| "course.enrolled"
	| "completion.recorded"

interface WebhookRow {
	id: number
	url: string
	signing_secret: string
}

function buildSignature(
	secret: string,
	body: string,
	timestamp: number,
): string {
	const payload = `${timestamp}.${body}`
	return crypto.createHmac("sha256", secret).update(payload).digest("hex")
}

async function deliver(
	webhook: WebhookRow,
	deliveryId: number,
	eventType: WebhookEventType,
	payload: unknown,
): Promise<void> {
	const body = JSON.stringify(payload)
	const timestamp = Math.floor(Date.now() / 1000)
	const sig = buildSignature(webhook.signing_secret, body, timestamp)

	let responseStatus: number | null = null
	let responseBody: string | null = null
	let succeeded = false

	try {
		const controller = new AbortController()
		const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

		const resp = await fetch(webhook.url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-LearnVault-Event": eventType,
				"X-LearnVault-Signature": `t=${timestamp},v1=${sig}`,
				"X-LearnVault-Delivery": String(deliveryId),
			},
			body,
			signal: controller.signal,
		})

		clearTimeout(timer)
		responseStatus = resp.status
		responseBody = (await resp.text()).slice(0, 2000)
		succeeded = resp.ok
	} catch (err) {
		responseBody = err instanceof Error ? err.message : "Unknown error"
	}

	await pool.query(
		`UPDATE provider_webhook_deliveries
		 SET status = $1, response_status = $2, response_body = $3,
		     delivered_at = $4, attempts = attempts + 1
		 WHERE id = $5`,
		[
			succeeded ? "delivered" : "failed",
			responseStatus,
			responseBody,
			succeeded ? new Date() : null,
			deliveryId,
		],
	)

	if (!succeeded) {
		await pool.query(
			`UPDATE provider_webhooks SET failure_count = failure_count + 1 WHERE id = $1`,
			[webhook.id],
		)
	} else {
		await pool.query(
			`UPDATE provider_webhooks
			 SET last_triggered_at = NOW(), failure_count = 0
			 WHERE id = $1`,
			[webhook.id],
		)
	}
}

export async function dispatchWebhookEvent(
	eventType: WebhookEventType,
	payload: unknown,
): Promise<void> {
	// Find all active webhooks subscribed to this event
	const result = await pool.query(
		`SELECT id, url, signing_secret
		 FROM provider_webhooks
		 WHERE is_active = true AND $1 = ANY(events)
		   AND failure_count < $2`,
		[eventType, MAX_ATTEMPTS * 5],
	)

	const webhooks = result.rows as WebhookRow[]
	if (webhooks.length === 0) return

	for (const webhook of webhooks) {
		// Create a delivery record first
		const deliveryResult = await pool.query(
			`INSERT INTO provider_webhook_deliveries (webhook_id, event_type, payload)
			 VALUES ($1, $2, $3)
			 RETURNING id`,
			[webhook.id, eventType, payload],
		)
		const deliveryId = deliveryResult.rows[0].id as number

		// Deliver async — don't await so we don't block the request
		deliver(webhook, deliveryId, eventType, payload).catch((err) => {
			log.error(
				{ err, webhookId: webhook.id, deliveryId },
				"Webhook delivery error",
			)
		})
	}
}
