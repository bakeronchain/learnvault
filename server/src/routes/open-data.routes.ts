import { Router } from "express"
import {
	getLeaderboard,
	getStats,
	getTreasuryFlows,
	listCourses,
	verifyCredential,
} from "../controllers/open-data.controller"
import { openDataAuth } from "../middleware/api-key.middleware"

/**
 * Public Open Data API (issue #1060) — versioned from the first commit so
 * breaking changes can ship as /v2 later without stranding consumers.
 */
export function createOpenDataRouter(): Router {
	const router = Router()

	const coursesAuth = openDataAuth("GET /courses")
	const statsAuth = openDataAuth("GET /stats")
	const leaderboardAuth = openDataAuth("GET /leaderboard")
	const treasuryAuth = openDataAuth("GET /treasury")
	const verifyAuth = openDataAuth("GET /credentials/verify")

	router.get("/v1/public/courses", coursesAuth, listCourses)
	router.get("/v1/public/stats", statsAuth, getStats)
	router.get("/v1/public/leaderboard", leaderboardAuth, getLeaderboard)
	router.get("/v1/public/treasury", treasuryAuth, getTreasuryFlows)
	router.get("/v1/public/credentials/:id/verify", verifyAuth, verifyCredential)

	return router
}
