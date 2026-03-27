import { Router } from "express"

import { getScholarsLeaderboard } from "../controllers/scholars.controller"

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
