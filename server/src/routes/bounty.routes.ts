import { Router } from "express"
import { type JwtService } from "../services/jwt.service"
import { createRequireAuth, createOptionalAuth } from "../middleware/auth.middleware"
import {
	listBounties,
	getBountyById,
	createBounty,
	claimBounty,
	submitWork,
	approveSubmission,
	cancelBounty,
} from "../controllers/bounty.controller"

export function createBountyRouter(jwtService: JwtService): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)
	const optionalAuth = createOptionalAuth(jwtService)

	router.get("/bounties", optionalAuth, (req, res) => {
		void listBounties(req, res)
	})

	router.get("/bounties/:id", optionalAuth, (req, res) => {
		void getBountyById(req, res)
	})

	router.post("/bounties", requireAuth, (req, res) => {
		void createBounty(req, res)
	})

	router.post("/bounties/:id/claim", requireAuth, (req, res) => {
		void claimBounty(req, res)
	})

	router.post("/bounties/:id/submit", requireAuth, (req, res) => {
		void submitWork(req, res)
	})

	router.post("/bounties/:id/approve", requireAuth, (req, res) => {
		void approveSubmission(req, res)
	})

	router.post("/bounties/:id/cancel", requireAuth, (req, res) => {
		void cancelBounty(req, res)
	})

	return router
}
