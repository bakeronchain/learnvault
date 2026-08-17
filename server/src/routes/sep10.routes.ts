import { type Request, type Response, Router } from "express"

import { nonceRateLimiter } from "../middleware/nonce-rate-limit.middleware"
import { authVerifyLimiter } from "../middleware/rate-limit.middleware"
import { type Sep10Service } from "../services/sep10.service"

export function createSep10Router(sep10Service: Sep10Service): Router {
	const router = Router()

	router.get("/", nonceRateLimiter, async (req: Request, res: Response) => {
		const account =
			typeof req.query.account === "string" ? req.query.account.trim() : ""

		if (!account) {
			res.status(400).json({ error: "Missing query parameter: account" })
			return
		}

		try {
			const challenge = await sep10Service.createChallenge(account)
			res.status(200).json(challenge)
		} catch (err) {
			const message = err instanceof Error ? err.message : "Bad request"
			if (message.includes("Invalid")) {
				res.status(400).json({ error: message })
				return
			}
			res.status(500).json({ error: message })
		}
	})

	router.post("/", authVerifyLimiter, async (req: Request, res: Response) => {
		const body = req.body as { transaction?: unknown }
		const signedTransaction =
			typeof body.transaction === "string" ? body.transaction.trim() : ""

		if (!signedTransaction) {
			res.status(400).json({ error: "Missing required field: transaction" })
			return
		}

		try {
			const { accessToken, refreshToken } =
				await sep10Service.verifySignedChallenge(signedTransaction)
			res.status(200).json({
				token: accessToken,
				refreshToken,
				tokenType: "Bearer",
				expiresIn: "24h",
			})
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unauthorized"
			if (message.includes("expired")) {
				res.status(401).json({ error: message })
				return
			}
			if (message.includes("Invalid") || message.includes("Missing")) {
				res.status(400).json({ error: message })
				return
			}
			res.status(401).json({ error: message })
		}
	})

	return router
}
