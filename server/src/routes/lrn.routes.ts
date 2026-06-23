import { Router } from "express"

import {
	getLrnBurnHistory,
	postBurnLrn,
} from "../controllers/lrn-burn.controller"
import {
	TOKEN_BURNED_EVENT,
	tokenEventsEmitter,
} from "../lib/token-events-emitter"
import { type AuthRequest, authMiddleware } from "../middleware/auth.middleware"

export const lrnRouter = Router()

/**
 * @openapi
 * /api/lrn/burn:
 *   post:
 *     tags: [LRN]
 *     summary: Burn LRN tokens on-chain
 *     description: |
 *       Verifies the caller holds sufficient LRN on the learn_token Soroban contract,
 *       invokes `burn`, persists the transaction hash, and emits a `token_burned` SSE event.
 *       When the server key does not match the wallet, pass a wallet-signed XDR as
 *       `signed_transaction`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: string
 *                 description: LRN amount in atomic units (7 decimals)
 *                 example: "10000000"
 *               signed_transaction:
 *                 type: string
 *                 description: Optional wallet-signed Soroban transaction XDR
 *     responses:
 *       201:
 *         description: Burn submitted and recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tx_hash: { type: string }
 *                 amount: { type: string }
 *                 burned_at: { type: string, format: date-time }
 *       400:
 *         description: Invalid amount or insufficient LRN balance
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       502:
 *         description: Soroban RPC call failed
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
lrnRouter.post("/lrn/burn", authMiddleware, (req, res) => {
	void postBurnLrn(req, res)
})

/**
 * @openapi
 * /api/lrn/burn/history:
 *   get:
 *     tags: [LRN]
 *     summary: List LRN burn history for the authenticated wallet
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Burn history
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
lrnRouter.get("/lrn/burn/history", authMiddleware, (req, res) => {
	void getLrnBurnHistory(req, res)
})

/**
 * @openapi
 * /api/stream/tokens:
 *   get:
 *     tags: [LRN]
 *     summary: Server-sent events for token balance updates
 *     description: Emits `token_burned` events for the authenticated wallet.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: text/event-stream
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
lrnRouter.get("/stream/tokens", authMiddleware, (req, res) => {
	const address = (req as AuthRequest).user?.address
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	res.setHeader("Content-Type", "text/event-stream")
	res.setHeader("Cache-Control", "no-cache")
	res.setHeader("Connection", "keep-alive")
	res.flushHeaders?.()

	const onBurn = (payload: {
		walletAddress: string
		amount: string
		txHash: string
		timestamp: string
	}) => {
		if (payload.walletAddress !== address) return
		res.write(
			`event: token_burned\ndata: ${JSON.stringify({
				wallet_address: payload.walletAddress,
				amount: payload.amount,
				tx_hash: payload.txHash,
				timestamp: payload.timestamp,
			})}\n\n`,
		)
	}

	tokenEventsEmitter.on(TOKEN_BURNED_EVENT, onBurn)

	const heartbeat = setInterval(() => {
		res.write(": heartbeat\n\n")
	}, 30_000)

	const cleanup = () => {
		clearInterval(heartbeat)
		tokenEventsEmitter.off(TOKEN_BURNED_EVENT, onBurn)
	}

	req.on("close", cleanup)
	req.on("aborted", cleanup)
	res.on("close", cleanup)
})
