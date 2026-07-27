import { type Request, type Response } from "express"
import { logger } from "../lib/logger"
import { type AuthRequest } from "../middleware/auth.middleware"
import {
	getRecommendations,
	logRecommendationEngagement,
} from "../services/recommendation.service"

const log = logger.child({ module: "recommendations" })

function parseLimit(value: unknown): number {
	const limitParam = typeof value === "string" ? parseInt(value, 10) : 4
	return !isNaN(limitParam) && limitParam > 0 ? limitParam : 4
}

export const getLearnerRecommendations = async (
	req: AuthRequest,
	res: Response,
): Promise<void> => {
	try {
		const walletAddress = req.walletAddress
		if (!walletAddress) {
			res.status(401).json({ error: "Unauthorized" })
			return
		}

		const limit = parseLimit(req.query.limit)
		const recommendations = await getRecommendations(walletAddress, limit)

		res.status(200).json({ data: recommendations })
	} catch (error) {
		log.error({ err: error }, "Failed to get recommendations")
		res.status(500).json({ error: "Internal server error" })
	}
}

export const getRecommendationsForAddress = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const address = req.params.address
		if (!address) {
			res.status(400).json({ error: "address is required" })
			return
		}

		const limit = parseLimit(req.query.limit)
		const recommendations = await getRecommendations(address, limit)

		res.status(200).json({ data: recommendations })
	} catch (error) {
		log.error({ err: error }, "Failed to get recommendations for address")
		res.status(500).json({ error: "Internal server error" })
	}
}

export const engageRecommendation = async (
	req: AuthRequest,
	res: Response,
): Promise<void> => {
	try {
		const walletAddress = req.walletAddress
		if (!walletAddress) {
			res.status(401).json({ error: "Unauthorized" })
			return
		}

		const { courseSlug, action } = req.body

		if (!courseSlug || typeof courseSlug !== "string") {
			res.status(400).json({ error: "courseSlug is required" })
			return
		}

		if (!action || !["view", "click", "dismiss"].includes(action)) {
			res
				.status(400)
				.json({ error: "action must be one of: view, click, dismiss" })
			return
		}

		await logRecommendationEngagement(
			walletAddress,
			courseSlug,
			action as "view" | "click" | "dismiss",
		)

		res.status(200).json({ success: true })
	} catch (error) {
		log.error({ err: error }, "Failed to log recommendation engagement")
		res.status(500).json({ error: "Internal server error" })
	}
}
