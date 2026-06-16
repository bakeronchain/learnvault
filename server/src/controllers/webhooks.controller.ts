import { type Request, type Response } from "express"
import { z } from "zod"

import { logger } from "../lib/logger"
import { processWebhookEvents } from "../services/event-indexer.service"

const log = logger.child({ module: "webhooks" })

const webhookEventSchema = z.object({
	id: z.string().min(1),
	type: z.string().min(1),
	contract: z.string().min(1),
	topic: z.string().min(1),
	ledger: z.union([z.string(), z.number()]),
	value: z.record(z.unknown()).optional(),
})

const webhookPayloadSchema = z.object({
	events: z.array(webhookEventSchema).min(1),
})

export async function handleHorizonWebhook(
	req: Request,
	res: Response,
): Promise<void> {
	const rawBody = req.body
	if (!Buffer.isBuffer(rawBody)) {
		res.status(400).json({ error: "Invalid request body" })
		return
	}

	let parsed: unknown
	try {
		parsed = JSON.parse(rawBody.toString("utf8"))
	} catch {
		res.status(400).json({ error: "Invalid JSON payload" })
		return
	}

	const result = webhookPayloadSchema.safeParse(parsed)
	if (!result.success) {
		res.status(400).json({ error: "Invalid webhook payload" })
		return
	}

	res.status(200).json({ received: true, count: result.data.events.length })

	void processWebhookEvents(result.data.events).catch((err) => {
		log.error({ err }, "Failed to process horizon webhook events")
	})
}
