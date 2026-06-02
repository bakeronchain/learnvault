import { Router } from "express"

import {
	approveMentor,
	createMentorshipRequest,
	getMentors,
} from "../controllers/mentorship.controller"
import { requireAdmin } from "../middleware/admin.middleware"
import { authMiddleware } from "../middleware/auth.middleware"

export const mentorshipRouter = Router()

mentorshipRouter.get("/mentorship/mentors", (req, res) => {
	void getMentors(req, res)
})

mentorshipRouter.post("/mentorship/request", authMiddleware, (req, res) => {
	void createMentorshipRequest(req, res)
})

mentorshipRouter.post(
	"/admin/mentors/approve/:address",
	requireAdmin,
	(req, res) => {
		void approveMentor(req, res)
	},
)
