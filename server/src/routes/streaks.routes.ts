import { Router } from "express"
import { getStreak, updateDailyGoal } from "../controllers/streaks.controller"
import { createRequireAuth } from "../middleware/auth.middleware"
import { type JwtService } from "../services/jwt.service"

export function createStreaksRouter(jwtService: JwtService): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)

	/**
	 * @openapi
	 * /api/streaks/{address}:
	 *   get:
	 *     tags: [Streaks]
	 *     summary: Get a learner's streak and daily goal state
	 *     description: Returns the learner's current/longest streak, daily goal, today's progress, and a 7-day activity window.
	 *     parameters:
	 *       - in: path
	 *         name: address
	 *         required: true
	 *         schema: { type: string }
	 *     responses:
	 *       200:
	 *         description: Streak state
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	router.get("/streaks/:address", (req, res) => {
		void getStreak(req, res)
	})

	/**
	 * @openapi
	 * /api/streaks/{address}/goal:
	 *   put:
	 *     tags: [Streaks]
	 *     summary: Set a learner's daily activity goal
	 *     description: Updates the authenticated learner's daily goal (1-20 milestones/day). The address must match the authenticated wallet.
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: address
	 *         required: true
	 *         schema: { type: string }
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required: [dailyGoal]
	 *             properties:
	 *               dailyGoal:
	 *                 type: integer
	 *                 minimum: 1
	 *                 maximum: 20
	 *     responses:
	 *       200:
	 *         description: Updated streak record
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 *       403:
	 *         description: Cannot update another learner's daily goal
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	router.put("/streaks/:address/goal", requireAuth, (req, res) => {
		void updateDailyGoal(req, res)
	})

	return router
}
