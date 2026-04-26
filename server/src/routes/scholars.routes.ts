import { Router } from "express"

import {
	getScholarMilestones,
	getScholarsLeaderboard,
	getScholarProfile,
	getScholarCredentials,
	getScholarEscrowTimeouts,
} from "../controllers/scholars.controller"
import { validate } from "../middleware/validation.middleware"

export const scholarsRouter = Router()

/**
 * @openapi
 * /api/scholars/leaderboard:
 *   get:
 *     tags: [Scholars]
 *     summary: Get scholars leaderboard
 *     description: Returns a paginated ranking of scholars by LRN balance, with optional search.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of scholars per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Filter scholars by wallet address (partial match)
 *     responses:
 *       200:
 *         description: Paginated scholars leaderboard
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rankings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ScholarRanking'
 *                 total:
 *                   type: integer
 *                 your_rank:
 *                   type: integer
 *                   nullable: true
 *                   description: Current user's rank (null if not authenticated or not ranked)
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
scholarsRouter.get("/scholars/leaderboard", (req, res) => {
	void getScholarsLeaderboard(req, res)
})

/**
 * @openapi
 * /api/scholars/{address}:
 *   get:
 *     tags: [Scholars]
 *     summary: Get scholar profile
 *     description: Returns a scholar's on-chain balances, enrolled courses, milestone stats, credentials, and join date.
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Scholar's Stellar wallet address
 *     responses:
 *       200:
 *         description: Scholar profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScholarProfile'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
scholarsRouter.get("/scholars/:address", (req, res) => {
	void getScholarProfile(req, res)
})

/**
 * @openapi
 * /api/scholars/{address}/milestones:
 *   get:
 *     tags: [Scholars]
 *     summary: Get milestones for a scholar
 *     description: Returns milestone reports for a scholar, optionally filtered by course or status.
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Scholar's Stellar wallet address
 *       - in: query
 *         name: course_id
 *         schema:
 *           type: string
 *         description: Filter milestones by course ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, verified, rejected]
 *         description: Filter milestones by status
 *     responses:
 *       200:
 *         description: Scholar milestones
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 milestones:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ScholarMilestone'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
scholarsRouter.get("/scholars/:address/milestones", (req, res) => {
	void getScholarMilestones(req, res)
})

/**
 * @openapi
 * /api/scholars/{address}/credentials:
 *   get:
 *     tags: [Scholars]
 *     summary: Get credentials for a scholar
 *     description: Returns all credentials (NFTs) earned by the scholar.
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Scholar's Stellar wallet address
 *     responses:
 *       200:
 *         description: Scholar credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 credentials:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Credential'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
scholarsRouter.get("/scholars/:address/credentials", (req, res) => {
	void getScholarCredentials(req, res)
})

scholarsRouter.get("/scholars/:address/escrow-timeouts", (req, res) => {
	void getScholarEscrowTimeouts(req, res)
})
