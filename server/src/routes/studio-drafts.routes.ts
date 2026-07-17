import { Router } from "express"
import { createRequireAuth } from "../middleware/auth.middleware"
import {
	createStudioDraft,
	getStudioDrafts,
	getStudioDraftsForAdmin,
	submitStudioDraft,
	updateStudioDraft,
	reviewStudioDraft,
} from "../controllers/studio-drafts.controller"
import { requireAdmin } from "../middleware/admin.middleware"
import { type JwtService } from "../services/jwt.service"

export function createStudioDraftsRouter(jwtService: JwtService): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)

	router.get("/studio/drafts", requireAuth, getStudioDrafts)
	router.get("/admin/studio/drafts", requireAdmin, getStudioDraftsForAdmin)
	router.post("/studio/drafts", requireAuth, createStudioDraft)
	router.put("/studio/drafts/:id", requireAuth, updateStudioDraft)
	router.post("/studio/drafts/:id/submit", requireAuth, submitStudioDraft)
	router.post(
		"/admin/studio/drafts/:id/review",
		requireAdmin,
		reviewStudioDraft,
	)

	return router
}

export const studioDraftsRouter = Router()
