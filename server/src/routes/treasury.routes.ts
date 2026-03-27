import { Router } from "express"

import {
	getTreasuryStats,
	getTreasuryActivity,
} from "../controllers/treasury.controller"

export const treasuryRouter = Router()

/**
 * @openapi
 * /api/treasury/stats:
 *   get:
 *     tags: [Treasury]
 *     summary: Get treasury statistics
 *     description: Returns aggregated statistics including total deposits, disbursements, scholars funded, active proposals, and donor count
 *     responses:
 *       200:
 *         description: Treasury statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_deposited_usdc:
 *                   type: string
 *                   description: Total USDC deposited (in stroops)
 *                   example: "125400000000"
 *                 total_disbursed_usdc:
 *                   type: string
 *                   description: Total USDC disbursed (in stroops)
 *                   example: "98200000000"
 *                 scholars_funded:
 *                   type: integer
 *                   description: Number of unique scholars funded
 *                   example: 128
 *                 active_proposals:
 *                   type: integer
 *                   description: Number of active scholarship proposals
 *                   example: 12
 *                 donors_count:
 *                   type: integer
 *                   description: Number of unique donors
 *                   example: 47
 *       500:
 *         description: Internal server error
 *       503:
 *         description: Treasury contract not configured
 */
treasuryRouter.get("/treasury/stats", getTreasuryStats)

/**
 * @openapi
 * /api/treasury/activity:
 *   get:
 *     tags: [Treasury]
 *     summary: Get treasury activity feed
 *     description: Returns recent treasury events including deposits and disbursements
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Maximum number of events to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *         description: Number of events to skip for pagination
 *     responses:
 *       200:
 *         description: Treasury activity events
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 events:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [deposit, disburse]
 *                         example: "deposit"
 *                       amount:
 *                         type: string
 *                         description: Amount in stroops
 *                         example: "500000000"
 *                       address:
 *                         type: string
 *                         description: Donor address (for deposits)
 *                         example: "GABC..."
 *                       scholar:
 *                         type: string
 *                         description: Scholar address (for disbursements)
 *                         example: "GDEF..."
 *                       tx_hash:
 *                         type: string
 *                         description: Transaction hash
 *                         example: "018d4d55354a1d4f6726932712954d0f5b6797a0d58478a5e89f6a9d3451d3d8"
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                         description: Event timestamp
 *       500:
 *         description: Internal server error
 *       503:
 *         description: Treasury contract not configured
 */
treasuryRouter.get("/treasury/activity", getTreasuryActivity)
