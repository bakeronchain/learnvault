import { Router } from "express"
import { getLearnerRecommendations, engageRecommendation } from "../controllers/recommendations.controller"
import { JwtService } from "../services/jwt.service"
import { createAuthMiddleware } from "../middleware/auth.middleware"

export const createRecommendationsRouter = (jwtService: JwtService): Router => {
	const router = Router()
	const authMiddleware = createAuthMiddleware(jwtService)

	router.get("/recommendations", authMiddleware, getLearnerRecommendations)
	router.post("/recommendations/engage", authMiddleware, engageRecommendation)

	return router
}
