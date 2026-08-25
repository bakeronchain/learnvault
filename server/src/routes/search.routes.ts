import { Router } from "express"
import rateLimit from "express-rate-limit"
import { search } from "../controllers/search.controller"

export function createSearchRouter(): Router {
	const router = Router()

	// Search is the cheapest endpoint to hammer the database with — tighter
	// than the general limiter.
	const searchLimiter = rateLimit({
		windowMs: 60 * 1000,
		limit: 30,
		standardHeaders: "draft-7",
		legacyHeaders: false,
		message: { error: "Too many search requests, please slow down" },
	})

	router.get("/search", searchLimiter, search)

	return router
}
