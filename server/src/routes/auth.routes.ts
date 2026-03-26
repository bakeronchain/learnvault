import { Router } from "express"

import { createAuthControllers } from "../controllers/auth.controller"
import { nonceRateLimiter } from "../middleware/nonce-rate-limit.middleware"
import { type AuthService } from "../services/auth.service"

export function createAuthRouter(authService: AuthService): Router {
	const router = Router()
	const { getNonce, postVerify, getChallenge, postChallengeVerify } =
		createAuthControllers(authService)

	router.get("/challenge", nonceRateLimiter, (req, res) => {
		void getChallenge(req, res)
	})

	router.post("/challenge/verify", (req, res) => {
		void postChallengeVerify(req, res)
	})

	router.get("/nonce", nonceRateLimiter, (req, res) => {
		void getNonce(req, res)
	})

	router.post("/verify", (req, res) => {
		void postVerify(req, res)
	})

	return router
}
