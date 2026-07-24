import { Router } from "express"
import {
	getLearnerRecommendations,
	getRecommendationsForAddress,
	engageRecommendation,
} from "../controllers/recommendations.controller"
import { apiResponseCache } from "../middleware/api-response-cache.middleware"
import {
	createOptionalAuth,
	createRequireAuth,
} from "../middleware/auth.middleware"
import { type JwtService } from "../services/jwt.service"

export const createRecommendationsRouter = (jwtService: JwtService): Router => {
	const router = Router()
	const authMiddleware = createRequireAuth(jwtService)
	const optionalAuth = createOptionalAuth(jwtService)

	router.get("/recommendations", authMiddleware, getLearnerRecommendations)

	/**
	 * @openapi
	 * /api/recommendations/{address}:
	 *   get:
	 *     tags: [Recommendations]
	 *     summary: Get personalized course recommendations for a learner
	 *     description: Returns a ranked list of recommended next courses with a human-readable reason per item, based on completed courses, path rules, and co-occurrence with similar learners.
	 *     parameters:
	 *       - in: path
	 *         name: address
	 *         required: true
	 *         schema: { type: string }
	 *       - in: query
	 *         name: limit
	 *         schema: { type: integer }
	 *     responses:
	 *       200:
	 *         description: Ranked recommendations
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	router.get(
		"/recommendations/:address",
		optionalAuth,
		apiResponseCache("recommendations"),
		getRecommendationsForAddress,
	)

	router.post("/recommendations/engage", authMiddleware, engageRecommendation)

	return router
}
