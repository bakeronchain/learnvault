import crypto from "crypto"
import { type Request, type Response } from "express"
import { pool } from "../db"
import { AppError } from "../errors/app-error-handler"
import { type WebhookEventType } from "../services/webhook-delivery.service"

const ALLOWED_EVENTS: WebhookEventType[] = [
	"milestone.completed",
	"course.enrolled",
	"completion.recorded",
]

function generateSigningSecret(): string {
	return `whsec_${crypto.randomBytes(24).toString("hex")}`
}

export const createWebhook = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const { url, events } = req.body as { url?: string; events?: string[] }

	if (!url || typeof url !== "string") {
		throw new AppError("url is required", 400)
	}

	try {
		new URL(url)
	} catch {
		throw new AppError("url must be a valid HTTPS URL", 400)
	}

	if (!url.startsWith("https://")) {
		throw new AppError("url must use HTTPS", 400)
	}

	if (!Array.isArray(events) || events.length === 0) {
		throw new AppError("events must be a non-empty array", 400)
	}

	const invalid = events.filter(
		(e) => !ALLOWED_EVENTS.includes(e as WebhookEventType),
	)
	if (invalid.length > 0) {
		throw new AppError(
			`Invalid event types: ${invalid.join(", ")}. Allowed: ${ALLOWED_EVENTS.join(", ")}`,
			400,
		)
	}

	const signingSecret = generateSigningSecret()

	const result = await pool.query(
		`INSERT INTO provider_webhooks (api_key_id, url, events, signing_secret)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, url, events, is_active, created_at`,
		[req.providerId, url, events, signingSecret],
	)

	// Return signing_secret only on creation — it will never be shown again
	res.status(201).json({
		data: { ...result.rows[0], signing_secret: signingSecret },
	})
}

export const listWebhooks = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const result = await pool.query(
		`SELECT id, url, events, is_active, failure_count, last_triggered_at, created_at
		 FROM provider_webhooks
		 WHERE api_key_id = $1
		 ORDER BY created_at DESC`,
		[req.providerId],
	)
	res.json({ data: result.rows })
}

export const deleteWebhook = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const id = parseInt(req.params.id, 10)
	if (isNaN(id)) throw new AppError("Invalid webhook id", 400)

	const result = await pool.query(
		`DELETE FROM provider_webhooks WHERE id = $1 AND api_key_id = $2`,
		[id, req.providerId],
	)

	if ((result.rowCount ?? 0) === 0) {
		throw new AppError("Webhook not found", 404)
	}

	res.status(204).send()
}

export const listDeliveries = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const webhookId = parseInt(req.params.id, 10)
	if (isNaN(webhookId)) throw new AppError("Invalid webhook id", 400)

	// Ensure the webhook belongs to this provider
	const ownerCheck = await pool.query(
		`SELECT id FROM provider_webhooks WHERE id = $1 AND api_key_id = $2`,
		[webhookId, req.providerId],
	)
	if (ownerCheck.rows.length === 0) throw new AppError("Webhook not found", 404)

	const result = await pool.query(
		`SELECT id, event_type, status, attempts, response_status, delivered_at, created_at
		 FROM provider_webhook_deliveries
		 WHERE webhook_id = $1
		 ORDER BY created_at DESC
		 LIMIT 100`,
		[webhookId],
	)

	res.json({ data: result.rows })
}
