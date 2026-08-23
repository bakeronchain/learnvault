import { Router } from "express"

import {
	createDeposit,
	getDepositsForAddress,
} from "../controllers/treasury-deposits.controller"
import {
	getTreasuryStats,
	getTreasuryActivity,
	getTreasuryAllocations,
} from "../controllers/treasury.controller"
import { apiResponseCache } from "../middleware/api-response-cache.middleware"

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
treasuryRouter.get(
	"/treasury/stats",
	apiResponseCache("treasury_stats"),
	getTreasuryStats,
)

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

/**
 * @openapi
 * /api/treasury/allocations:
 *   get:
 *     tags: [Treasury]
 *     summary: Get strategy allocation breakdown
 *     description: >
 *       Returns the idle / allocated / yield breakdown sourced from on-chain
 *       treasury state, the venue currently holding allocated funds, and a
 *       recent allocation lifecycle event trail (allocated, deallocated,
 *       harvested, emergency_withdraw).
 *     parameters:
 * /api/treasury/deposit:
 *   post:
 *     tags: [Treasury]
 *     summary: Record a sponsor deposit
 *     description: Validates and records a donor deposit after on-chain verification. Calculates GOV tokens issued (amount * 100) and returns updated balance.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - donor_address
 *               - amount
 *               - tx_hash
 *             properties:
 *               donor_address:
 *                 type: string
 *                 description: Stellar address of the donor
 *                 example: "GABC..."
 *               amount:
 *                 type: number
 *                 description: Deposit amount in USDC (up to 7 decimals)
 *                 example: 100.5
 *               tx_hash:
 *                 type: string
 *                 description: 64-character hex transaction hash
 *                 example: "a1b2c3..."
 *     responses:
 *       201:
 *         description: Deposit recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deposit:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     donor_address:
 *                       type: string
 *                     amount_usdc:
 *                       type: string
 *                     gov_issued:
 *                       type: string
 *                     tx_hash:
 *                       type: string
 *                     deposited_at:
 *                       type: string
 *                       format: date-time
 *                 gov_balance:
 *                   type: string
 *                   description: Updated GOV token balance (atomic units)
 *       400:
 *         description: On-chain verification failed
 *       409:
 *         description: Transaction already recorded
 *       422:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
treasuryRouter.post("/treasury/deposit", createDeposit)

/**
 * @openapi
 * /api/treasury/deposits/{address}:
 *   get:
 *     tags: [Treasury]
 *     summary: Get deposit history for a donor
 *     description: Returns paginated deposit history for a specific donor address, ordered by timestamp descending
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Stellar address of the donor
 *         example: "GABC..."
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Maximum number of deposits to return
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Page number for pagination
 *     responses:
 *       200:
 *         description: Deposit history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [allocated, deallocated, harvested, emergency_withdraw]
 *                       amount:
 *                         type: string
 *                       tx_hash:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       500:
 *         description: Internal server error
 *       503:
 *         description: Treasury contract not configured
 */
treasuryRouter.get(
	"/treasury/allocations",
	apiResponseCache("treasury_allocations"),
	getTreasuryAllocations,
)
 *                       id:
 *                         type: integer
 *                       donor_address:
 *                         type: string
 *                       amount_usdc:
 *                         type: string
 *                       gov_issued:
 *                         type: string
 *                       tx_hash:
 *                         type: string
 *                       deposited_at:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       422:
 *         description: Invalid address format
 *       500:
 *         description: Internal server error
 */
treasuryRouter.get("/treasury/deposits/:address", getDepositsForAddress)
