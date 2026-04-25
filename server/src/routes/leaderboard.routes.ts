import { Router } from "express"

import {
	getLeaderboard,
	streamLeaderboard,
} from "../controllers/leaderboard.controller"

export const leaderboardRouter = Router()

/**
 * @openapi
 * /api/leaderboard:
 *   get:
 *     tags: [Leaderboard]
 *     summary: List top learners
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Max number of learners to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Pagination offset
 *     responses:
 *       200:
 *         description: Leaderboard fetched successfully
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
 *                       rank: { type: "integer" }
 *                       address: { type: "string" }
 *                       fullAddress: { type: "string" }
 *                       balance: { type: "string" }
 *                       completedCourses: { type: "integer" }
 *                 total: { type: "integer" }
 *                 limit: { type: "integer" }
 *                 offset: { type: "integer" }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
leaderboardRouter.get("/leaderboard", getLeaderboard)
leaderboardRouter.get("/leaderboard/stream", streamLeaderboard)
