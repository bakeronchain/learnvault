import { type Response } from "express"
import { type AuthRequest } from "../middleware/auth.middleware"
import { getRecommendations, logRecommendationEngagement } from "../services/recommendation.service"
import { logger } from "../lib/logger"

const log = logger.child({ module: "recommendations" })

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

		const limitParam = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 4
		const limit = !isNaN(limitParam) && limitParam > 0 ? limitParam : 4

		const recommendations = await getRecommendations(walletAddress, limit)
		
		res.status(200).json({ data: recommendations })
	} catch (error) {
		log.error({ err: error }, "Failed to get recommendations")
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
			res.status(400).json({ error: "action must be one of: view, click, dismiss" })
			return
		}

		await logRecommendationEngagement(walletAddress, courseSlug, action as "view" | "click" | "dismiss")

		res.status(200).json({ success: true })
	} catch (error) {
		log.error({ err: error }, "Failed to log recommendation engagement")
		res.status(500).json({ error: "Internal server error" })
	}
}
