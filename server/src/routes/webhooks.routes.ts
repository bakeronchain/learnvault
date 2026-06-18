import { Router } from "express"

import { handleHorizonWebhook } from "../controllers/webhooks.controller"
import { verifyWebhookSignature } from "../middleware/webhook-signature.middleware"

export const webhooksRouter = Router()

/**
 * @openapi
 * /api/webhooks/horizon:
 *   post:
 *     tags: [Webhooks]
 *     summary: Receive Stellar Horizon event notifications
 *     description: |
 *       Accepts signed webhook payloads from Horizon or a relay service.
 *       Returns 200 immediately and processes events asynchronously.
 *     parameters:
 *       - in: header
 *         name: X-Webhook-Signature
 *         required: true
 *         schema:
 *           type: string
 *         description: HMAC-SHA256 signature of the raw body (`sha256=<hex>`)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [events]
 *             properties:
 *               events:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [id, type, contract, topic, ledger]
 *                   properties:
 *                     id: { type: string }
 *                     type: { type: string }
 *                     contract: { type: string }
 *                     topic: { type: string }
 *                     ledger: { oneOf: [{ type: string }, { type: number }] }
 *                     value: { type: object }
 *     responses:
 *       200:
 *         description: Payload accepted for async processing
 *       400:
 *         description: Invalid payload
 *       401:
 *         description: Missing or invalid signature
 *       503:
 *         description: Webhook secret not configured
 */
webhooksRouter.post(
	"/horizon",
	verifyWebhookSignature,
	handleHorizonWebhook,
)
