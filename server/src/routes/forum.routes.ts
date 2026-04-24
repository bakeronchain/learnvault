import { Router } from "express"

import {
	createForumThread,
	deleteForumReply,
	deleteForumThread,
	getForumThread,
	listForumThreads,
	replyToForumThread,
} from "../controllers/forum.controller"
import { createRequireAuth } from "../middleware/auth.middleware"
import { requireCourseAdmin } from "../middleware/course-admin.middleware"
import { type JwtService } from "../services/jwt.service"

export function createForumRouter(jwtService: JwtService): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)

	router.get("/courses/:idOrSlug/forum", listForumThreads)
	router.get("/courses/:idOrSlug/forum/:threadId", getForumThread)
	
	router.post("/courses/:idOrSlug/forum", requireAuth, createForumThread)
	router.post("/courses/:idOrSlug/forum/:threadId/replies", requireAuth, replyToForumThread)
	
	router.delete("/courses/:idOrSlug/forum/:threadId", requireCourseAdmin, deleteForumThread)
	router.delete("/courses/:idOrSlug/forum/replies/:replyId", requireCourseAdmin, deleteForumReply)

	return router
}
