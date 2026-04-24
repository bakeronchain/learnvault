import { Router } from "express"

import { createMeWalletHandlers, getMe } from "../controllers/me.controller"
import {
	linkWalletBodySchema,
	setPrimaryWalletBodySchema,
} from "../lib/zod-schemas"
import { createRequireAuth } from "../middleware/auth.middleware"
import { validate } from "../middleware/validate.middleware"
import { type AuthService } from "../services/auth.service"
import { type JwtService } from "../services/jwt.service"

export function createMeRouter(
	jwtService: JwtService,
	authService: AuthService,
): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)
	const { postLinkWallet, postSetPrimaryWallet } =
		createMeWalletHandlers(authService)

	router.get("/me", requireAuth, getMe)

	router.post(
		"/me/wallets/link",
		requireAuth,
		validate({ body: linkWalletBodySchema }),
		(req, res) => {
			void postLinkWallet(req, res)
		},
	)

	router.post(
		"/me/wallets/primary",
		requireAuth,
		validate({ body: setPrimaryWalletBodySchema }),
		(req, res) => {
			void postSetPrimaryWallet(req, res)
		},
	)

	return router
}
