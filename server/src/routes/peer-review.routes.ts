import { Router } from "express"
import {
	getPeerReviewQueueHandler,
	submitPeerReviewHandler,
} from "../controllers/peer-review.controller"
import {
	milestoneReportIdParamSchema,
	peerReviewSubmitBodySchema,
} from "../lib/zod-schemas"
import { createRequireAuth } from "../middleware/auth.middleware"
import { validate } from "../middleware/validate.middleware"
import { type JwtService } from "../services/jwt.service"

export function createPeerReviewRouter(jwtService: JwtService): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)

	router.get("/peer-review/queue", requireAuth, getPeerReviewQueueHandler)

	router.post(
		"/peer-review/reports/:id",
		requireAuth,
		validate({
			params: milestoneReportIdParamSchema,
			body: peerReviewSubmitBodySchema,
		}),
		submitPeerReviewHandler,
	)

	return router
}
