import { Router, type Response } from "express"

import {
	contribute,
	createRound,
	finalizeRound,
	getStandings,
	listRounds,
} from "../controllers/qf.controller"
import { requireAdmin } from "../middleware/admin.middleware"
import { authMiddleware, type AuthRequest } from "../middleware/auth.middleware"
import { writeLimiter } from "../middleware/rate-limit.middleware"

export const qfRouter = Router()

/**
 * @openapi
 * /api/qf/rounds:
 *   get:
 *     tags: [QuadraticFunding]
 *     summary: List quadratic-funding rounds
 *     responses:
 *       200:
 *         description: List of QF rounds with their effective status
 *   post:
 *     tags: [QuadraticFunding]
 *     summary: Create a quadratic-funding round (admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, matching_pool, start_ts, end_ts]
 *             properties:
 *               name:
 *                 type: string
 *               matching_pool:
 *                 type: number
 *                 description: Total matching pool in USDC
 *               start_ts:
 *                 type: string
 *                 format: date-time
 *               end_ts:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Round created
 *       400:
 *         description: Invalid round data
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
qfRouter.get("/qf/rounds", (req, res) => {
	void listRounds(req, res)
})

qfRouter.post("/qf/rounds", requireAdmin, (req, res) => {
	void createRound(req, res)
})

/**
 * @openapi
 * /api/qf/rounds/{id}/standings:
 *   get:
 *     tags: [QuadraticFunding]
 *     summary: Live quadratic-funding standings / match estimator
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Per-proposal raised amount, unique contributors and estimated match
 *       404:
 *         description: Round not found
 */
qfRouter.get("/qf/rounds/:id/standings", (req, res) => {
	void getStandings(req, res)
})

/**
 * @openapi
 * /api/qf/rounds/{id}/contribute:
 *   post:
 *     tags: [QuadraticFunding]
 *     summary: Record a tx-verified contribution to a proposal in a round
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [proposal_id, amount_usdc, tx_hash]
 *             properties:
 *               proposal_id:
 *                 type: integer
 *               amount_usdc:
 *                 type: number
 *               tx_hash:
 *                 type: string
 *     responses:
 *       201:
 *         description: Contribution recorded
 *       400:
 *         description: Invalid data or transaction verification failed
 *       403:
 *         description: Identity verification required (anti-sybil gate)
 *       404:
 *         description: Round not found
 *       409:
 *         description: Round not open or transaction already recorded
 */
qfRouter.post("/qf/rounds/:id/contribute", authMiddleware, writeLimiter, (req, res) => {
	void contribute(req as AuthRequest, res as Response)
})

/**
 * @openapi
 * /api/qf/rounds/{id}/finalize:
 *   post:
 *     tags: [QuadraticFunding]
 *     summary: Finalize a round and produce a disbursement plan (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Disbursement plan bounded by the matching pool
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Round not found
 *       409:
 *         description: Round already finalized
 */
qfRouter.post("/qf/rounds/:id/finalize", requireAdmin, (req, res) => {
	void finalizeRound(req, res)
})
