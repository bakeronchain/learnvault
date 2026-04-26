import { Router } from "express"

import { createMeController } from "../controllers/me.controller"
import { createRequireAuth } from "../middleware/auth.middleware"
import { type AuthService } from "../services/auth.service"
import { type JwtService } from "../services/jwt.service"

export function createMeRouter(
	jwtService: JwtService,
	authService: AuthService,
): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)
	const { getMe, postLinkWallet, patchPrimaryWallet } =
		createMeController(authService)

	router.get("/me", requireAuth, (req, res) => {
		void getMe(req, res)
	})
	router.post("/me/wallets/link", requireAuth, (req, res) => {
		void postLinkWallet(req, res)
	})
	router.patch("/me/wallets/primary", requireAuth, (req, res) => {
		void patchPrimaryWallet(req, res)
	})

	return router
}
