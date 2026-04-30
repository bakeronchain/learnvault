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
import { validate } from "../middleware/validation.middleware"
import { type JwtService } from "../services/jwt.service"

export function createScholarsRouter (jwtService: JwtService): Router {
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
<<<<<<< HEAD

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
=======

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

<<<<<<< HEAD
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

scholarsRouter.get("/scholars/:address", (req, res) => {
	void getScholarProfile(req, res)
})