import { type Request, type Response } from "express"

import { logger } from "../lib/logger"
import { type AuthRequest } from "../middleware/auth.middleware"
import {
	buildSponsorAccountTransaction,
	getSponsorStatus,
} from "../services/sponsorship.service"

const log = logger.child({ module: "onboarding" })

function errorStatus(message: string): number {
	const isClientError =
		message.includes("required") ||
		message.includes("must be") ||
		message.includes("not configured")
	return isClientError ? (message.includes("not configured") ? 503 : 400) : 500
}

/**
 * A learner with zero XLM has no session yet — this is the bootstrap step
 * that gets them one, so unlike the relay endpoint it's intentionally NOT
 * gated behind requireAuth. The learner supplies the public key of a keypair
 * they just generated/connected locally; the server never sees a secret key.
 * Same shape as wallet.controller.ts's deployWallet (also a pre-auth
 * onboarding entry point), just for a classic keypair instead of a passkey
 * smart wallet.
 */
export async function sponsorAccount(
	req: Request,
	res: Response,
): Promise<void> {
	const body = (req.body ?? {}) as {
		learnerAddress?: unknown
		withUsdcTrustline?: unknown
	}

	if (!body.learnerAddress || typeof body.learnerAddress !== "string") {
		res.status(400).json({ error: "learnerAddress is required" })
		return
	}
	if (
		body.withUsdcTrustline !== undefined &&
		typeof body.withUsdcTrustline !== "boolean"
	) {
		res.status(400).json({ error: "withUsdcTrustline must be a boolean" })
		return
	}

	const learnerAddress = body.learnerAddress

	try {
		const result = await buildSponsorAccountTransaction(learnerAddress, {
			// Default true: a learner who can't hold the USDC they'll earn isn't
			// really onboarded. Explicit `false` opts out.
			withUsdcTrustline: body.withUsdcTrustline ?? true,
		})
		res.status(200).json(result)
	} catch (err) {
		log.error({ err, learnerAddress }, "Failed to build sponsor-account transaction")
		const message = err instanceof Error ? err.message : "Internal server error"
		res.status(errorStatus(message)).json({ error: message })
	}
}

export async function sponsorStatus(
	_req: AuthRequest,
	res: Response,
): Promise<void> {
	try {
		const status = await getSponsorStatus()
		res.status(200).json(status)
	} catch (err) {
		log.error({ err }, "Failed to fetch sponsor status")
		res.status(500).json({ error: "Failed to fetch sponsor status" })
	}
}
