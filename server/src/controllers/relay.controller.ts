import { type Response } from "express"

import { logger } from "../lib/logger"
import { type AuthRequest } from "../middleware/auth.middleware"
import { RelayRejection, submitFeeBump } from "../services/relayer.service"

const log = logger.child({ module: "relay" })

const REJECTION_STATUS: Record<string, number> = {
	RELAYER_NOT_CONFIGURED: 503,
}

export async function feeBump(req: AuthRequest, res: Response): Promise<void> {
	const learnerAddress = req.walletAddress
	if (!learnerAddress) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const body = (req.body ?? {}) as { innerTxXdr?: unknown }
	if (!body.innerTxXdr || typeof body.innerTxXdr !== "string") {
		res.status(400).json({ error: "innerTxXdr is required" })
		return
	}

	try {
		const result = await submitFeeBump(body.innerTxXdr, learnerAddress)
		res.status(200).json(result)
	} catch (err) {
		if (err instanceof RelayRejection) {
			log.warn(
				{ learnerAddress, reason: err.reason, message: err.message },
				"Relay request rejected",
			)
			res
				.status(REJECTION_STATUS[err.reason] ?? 400)
				.json({ error: err.message, reason: err.reason })
			return
		}

		log.error({ err, learnerAddress }, "Fee-bump relay failed")
		const message = err instanceof Error ? err.message : "Internal server error"
		res.status(500).json({ error: message })
	}
}
