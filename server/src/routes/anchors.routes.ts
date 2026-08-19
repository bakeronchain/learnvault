import { Router } from "express"

import {
	getAuthChallenge,
	getQuote,
	listAnchors,
	listWithdrawals,
	reconcile,
	submitAuth,
	withdraw,
} from "../controllers/anchors.controller"
import { createRequireAuth } from "../middleware/auth.middleware"
import { nonceRateLimiter } from "../middleware/nonce-rate-limit.middleware"
import { generalLimiter, writeLimiter } from "../middleware/rate-limit.middleware"
import { type JwtService } from "../services/jwt.service"

export function createAnchorsRouter(jwtService: JwtService): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)

	/**
	 * @openapi
	 * /api/anchors:
	 *   get:
	 *     tags: [Anchors]
	 *     summary: List allowlisted anchors, optionally filtered by country
	 *     parameters:
	 *       - in: query
	 *         name: country
	 *         schema: { type: string }
	 *         description: ISO 3166-1 alpha-2 country code
	 *     responses:
	 *       200:
	 *         description: Allowlisted anchors serving the given country (or all, if omitted)
	 */
	router.get("/anchors", generalLimiter, (req, res) => {
		void listAnchors(req, res)
	})

	/**
	 * @openapi
	 * /api/anchors/{domain}/auth-challenge:
	 *   get:
	 *     tags: [Anchors]
	 *     summary: Fetch a SEP-10 challenge from the anchor for the learner's wallet to sign
	 *     description: >
	 *       Proxies the anchor's own WEB_AUTH_ENDPOINT. The learner signs the
	 *       returned transaction locally (their wallet, never this server) and
	 *       submits it via POST /api/anchors/{domain}/auth.
	 *     parameters:
	 *       - in: path
	 *         name: domain
	 *         required: true
	 *         schema: { type: string }
	 *       - in: query
	 *         name: account
	 *         required: true
	 *         schema: { type: string }
	 *     responses:
	 *       200:
	 *         description: Challenge transaction XDR
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       404:
	 *         description: Anchor domain is not on the allowlist
	 */
	router.get(
		"/anchors/:domain/auth-challenge",
		nonceRateLimiter,
		(req, res) => {
			void getAuthChallenge(req, res)
		},
	)

	/**
	 * @openapi
	 * /api/anchors/{domain}/auth:
	 *   post:
	 *     tags: [Anchors]
	 *     summary: Submit the learner-signed SEP-10 challenge to the anchor
	 *     parameters:
	 *       - in: path
	 *         name: domain
	 *         required: true
	 *         schema: { type: string }
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required: [signedTransactionXdr]
	 *             properties:
	 *               signedTransactionXdr: { type: string }
	 *     responses:
	 *       200:
	 *         description: Anchor's SEP-10 token
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       404:
	 *         description: Anchor domain is not on the allowlist
	 */
	router.post("/anchors/:domain/auth", writeLimiter, (req, res) => {
		void submitAuth(req, res)
	})

	/**
	 * @openapi
	 * /api/anchors/{domain}/quote:
	 *   get:
	 *     tags: [Anchors]
	 *     summary: Get a price quote from the anchor's SEP-38 quote server
	 *     description: >
	 *       Returns an indicative price if no anchor auth token is supplied, or
	 *       a firm, expiring quote (SEP-38 POST /quote) when an
	 *       `Authorization: Bearer <anchor token>` header is present.
	 *     parameters:
	 *       - in: path
	 *         name: domain
	 *         required: true
	 *         schema: { type: string }
	 *       - in: query
	 *         name: sell
	 *         required: true
	 *         schema: { type: string }
	 *       - in: query
	 *         name: buy
	 *         required: true
	 *         schema: { type: string }
	 *       - in: query
	 *         name: amount
	 *         required: true
	 *         schema: { type: string }
	 *     responses:
	 *       200:
	 *         description: Indicative price or firm quote
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       404:
	 *         description: Anchor domain is not on the allowlist
	 */
	router.get("/anchors/:domain/quote", generalLimiter, (req, res) => {
		void getQuote(req, res)
	})

	/**
	 * @openapi
	 * /api/anchors/{domain}/withdraw:
	 *   post:
	 *     tags: [Anchors]
	 *     summary: Start an interactive SEP-24 withdrawal
	 *     security: [{ bearerAuth: [] }]
	 *     parameters:
	 *       - in: path
	 *         name: domain
	 *         required: true
	 *         schema: { type: string }
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required: [assetCode, assetOut, amount, anchorToken]
	 *             properties:
	 *               assetCode: { type: string, description: "e.g. USDC" }
	 *               assetOut: { type: string, description: "e.g. NGN" }
	 *               amount: { type: string }
	 *               quoteId: { type: string, description: "SEP-38 firm quote id, if one was obtained" }
	 *               anchorToken: { type: string, description: "Anchor's own SEP-10 token" }
	 *     responses:
	 *       201:
	 *         description: Interactive withdrawal started
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       401:
	 *         description: Unauthorized
	 *       404:
	 *         description: Anchor domain is not on the allowlist
	 */
	router.post(
		"/anchors/:domain/withdraw",
		requireAuth,
		writeLimiter,
		(req, res) => {
			void withdraw(req, res)
		},
	)

	/**
	 * @openapi
	 * /api/anchors/{domain}/withdrawals/{transactionId}/reconcile:
	 *   post:
	 *     tags: [Anchors]
	 *     summary: Re-poll the anchor for a withdrawal's current status and persist it
	 *     security: [{ bearerAuth: [] }]
	 *     parameters:
	 *       - in: path
	 *         name: domain
	 *         required: true
	 *         schema: { type: string }
	 *       - in: path
	 *         name: transactionId
	 *         required: true
	 *         schema: { type: string }
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required: [anchorToken]
	 *             properties:
	 *               anchorToken: { type: string }
	 *     responses:
	 *       200:
	 *         description: Reconciled withdrawal row
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       401:
	 *         description: Unauthorized
	 *       404:
	 *         description: Withdrawal not found for this learner, or anchor domain not allowlisted
	 */
	router.post(
		"/anchors/:domain/withdrawals/:transactionId/reconcile",
		requireAuth,
		writeLimiter,
		(req, res) => {
			void reconcile(req, res)
		},
	)

	/**
	 * @openapi
	 * /api/anchors/withdrawals:
	 *   get:
	 *     tags: [Anchors]
	 *     summary: The authenticated learner's anchor withdrawal history
	 *     security: [{ bearerAuth: [] }]
	 *     responses:
	 *       200:
	 *         description: Withdrawal rows for this learner, most recent first
	 *       401:
	 *         description: Unauthorized
	 */
	router.get("/anchors/withdrawals", requireAuth, (req, res) => {
		void listWithdrawals(req, res)
	})

	return router
}
