import { Router } from "express"

import { createAuthControllers } from "../controllers/auth.controller"
import { nonceRateLimiter } from "../middleware/nonce-rate-limit.middleware"
import { authVerifyLimiter } from "../middleware/rate-limit.middleware"
import { type AuthService } from "../services/auth.service"

export function createAuthRouter(authService: AuthService): Router {
	const router = Router()
	const { getNonce, postVerify, getChallenge, postChallengeVerify, postLogout } =
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

	router.post("/verify", authVerifyLimiter, (req, res) => {
		void postVerify(req, res)
	})

	router.post("/logout", (req, res) => {
		void postLogout(req, res)
	})


	return router
}
