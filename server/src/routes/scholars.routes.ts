import { Router } from "express"

import {
	getScholarMilestones,
	getScholarsLeaderboard,
	getScholarProfile,
	getScholarCredentials,
	getScholarEscrowTimeouts,
} from "../controllers/scholars.controller"
import { validate } from "../middleware/validation.middleware"

	/**
	 * @openapi
	 * /api/scholars/{address}/credentials:
	 *   get:
	 *     tags: [Scholars]
	 *     summary: Get credentials for a scholar
	 *     parameters:
	 *       - in: path
	 *         name: address
	 *         required: true
	 *         schema: { type: string }
	 *     responses:
	 *       200:
	 *         description: Scholar credentials
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	router.get("/scholars/:address/credentials", (req, res) => {
		void getScholarCredentials(req, res)
	})

	router.get("/scholars/:address/escrow-timeouts", (req, res) => {
		void getScholarEscrowTimeouts(req, res)
	})

	/**
	 * @openapi
	 * /api/scholars/{address}/follow:
	 *   post:
	 *     tags: [Scholars]
	 *     summary: Follow a scholar
	 *     security: [{ bearerAuth: [] }]
	 *     parameters:
	 *       - in: path
	 *         name: address
	 *         required: true
	 *         schema: { type: string }
	 *     responses:
	 *       200:
	 *         description: Followed successfully
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 *   delete:
	 *     tags: [Scholars]
	 *     summary: Unfollow a scholar
	 *     security: [{ bearerAuth: [] }]
	 *     parameters:
	 *       - in: path
	 *         name: address
	 *         required: true
	 *         schema: { type: string }
	 *     responses:
	 *       200:
	 *         description: Unfollowed successfully
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 *   get:
	 *     tags: [Scholars]
	 *     summary: Get follow status and counts
	 *     parameters:
	 *       - in: path
	 *         name: address
	 *         required: true
	 *         schema: { type: string }
	 *     responses:
	 *       200:
	 *         description: Follow status
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	router.post("/scholars/:address/follow", requireAuth, (req, res) => {
		void followScholar(req as any, res)
	})

	router.delete("/scholars/:address/follow", requireAuth, (req, res) => {
		void unfollowScholar(req as any, res)
	})

	router.get("/scholars/:address/follow", (req, res) => {
		void getFollowStatus(req as any, res)
	})

	return router
}
