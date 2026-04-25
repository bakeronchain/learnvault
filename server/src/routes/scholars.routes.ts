import { Router } from "express"

import {
	getScholarMilestones,
	getScholarsLeaderboard,
	getScholarProfile,
	getScholarCredentials,
	getScholarEscrowTimeouts,
} from "../controllers/scholars.controller"
import {
	followScholar,
	unfollowScholar,
	getFollowStatus,
} from "../controllers/social.controller"
import {
	createRequireAuth,
	createOptionalAuth,
} from "../middleware/auth.middleware"
import { type JwtService } from "../services/jwt.service"

export function createScholarsRouter(jwtService: JwtService): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)
	const optionalAuth = createOptionalAuth(jwtService)

	/**
	 * @openapi
	 * /api/scholars/leaderboard:
	 *   get:
	 *     tags: [Scholars]
	 *     summary: Get scholars leaderboard
	 *     description: Returns a paginated ranking of scholars by LRN balance, with optional search.
	 */
	router.get("/scholars/leaderboard", (req, res) => {
		void getScholarsLeaderboard(req, res)
	})

	/**
	 * @openapi
	 * /api/scholars/{address}:
	 *   get:
	 *     tags: [Scholars]
	 *     summary: Get scholar profile
	 *     description: Returns a scholar's on-chain balances, enrolled courses, milestone stats, credentials, and join date.
	 */
	router.get("/scholars/:address", optionalAuth, (req, res) => {
		void getScholarProfile(req, res)
	})

	/**
	 * @openapi
	 * /api/scholars/{address}/milestones:
	 *   get:
	 *     tags: [Scholars]
	 *     summary: Get milestones for a scholar
	 */
	router.get("/scholars/:address/milestones", (req, res) => {
		void getScholarMilestones(req, res)
	})

	/**
	 * @openapi
	 * /api/scholars/{address}/credentials:
	 *   get:
	 *     tags: [Scholars]
	 *     summary: Get credentials for a scholar
	 */
	router.get("/scholars/:address/credentials", (req, res) => {
		void getScholarCredentials(req, res)
	})

	router.get("/scholars/:address/escrow-timeouts", (req, res) => {
		void getScholarEscrowTimeouts(req, res)
	})

	// ── Social Following ───────────────────────────────────────────────────────

	/**
	 * @openapi
	 * /api/scholars/{address}/follow:
	 *   post:
	 *     tags: [Scholars]
	 *     summary: Follow a scholar
	 *     security: [{ bearerAuth: [] }]
	 *   delete:
	 *     tags: [Scholars]
	 *     summary: Unfollow a scholar
	 *     security: [{ bearerAuth: [] }]
	 *   get:
	 *     tags: [Scholars]
	 *     summary: Get follow status and counts
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
