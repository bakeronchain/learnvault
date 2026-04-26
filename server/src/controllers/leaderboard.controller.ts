import { type Request, type Response } from "express"
import {
	leaderboardEmitter,
	LEADERBOARD_UPDATE_EVENT,
} from "../lib/leaderboard-emitter"
import { getLeaderboardData } from "../services/leaderboard.service"

/**
 * List top learners (Standard API)
 */
export const getLeaderboard = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const limit = Number.parseInt(String(req.query.limit ?? "10"), 10)
		const offset = Number.parseInt(String(req.query.offset ?? "0"), 10)

		const normalizedLimit = Number.isNaN(limit)
			? 10
			: Math.max(1, Math.min(limit, 50))
		const page = Math.floor(offset / normalizedLimit) + 1

		const data = await getLeaderboardData({
			page,
			limit: normalizedLimit,
			viewerAddress: req.walletAddress,
		})

		res.status(200).json({
			data: data.rankings,
			total: data.total,
			limit: normalizedLimit,
			offset: (page - 1) * normalizedLimit,
		})
	} catch (err) {
		console.error("[leaderboard] getLeaderboard error:", err)
		res.status(500).json({ error: "Internal Server Error" })
	}
}

/**
 * Stream leaderboard updates via SSE
 */
export const streamLeaderboard = async (
	req: Request,
	res: Response,
): Promise<void> => {
	// Set headers for SSE
	res.setHeader("Content-Type", "text/event-stream")
	res.setHeader("Cache-Control", "no-cache")
	res.setHeader("Connection", "keep-alive")
	res.flushHeaders()

	const limit = Math.min(
		Number.parseInt(String(req.query.limit ?? "10"), 10),
		50,
	)
	const viewerAddress = req.walletAddress

	let lastUpdate = 0
	const THROTTLE_MS = 10000 // 10 seconds

	const sendUpdate = async () => {
		const now = Date.now()
		if (now - lastUpdate < THROTTLE_MS) return

		try {
			const data = await getLeaderboardData({
				page: 1,
				limit,
				viewerAddress,
			})
			res.write(`data: ${JSON.stringify(data)}\n\n`)
			lastUpdate = now
		} catch (err) {
			console.error("[leaderboard:stream] Error fetching updates:", err)
		}
	}

	// Send initial data
	await sendUpdate()

	// Subscribe to updates
	const onUpdate = () => {
		void sendUpdate()
	}

	leaderboardEmitter.on(LEADERBOARD_UPDATE_EVENT, onUpdate)

	// Keep connection alive with heartbeat
	const heartbeat = setInterval(() => {
		res.write(": heartbeat\n\n")
	}, 30000)

	// Clean up on disconnect
	req.on("close", () => {
		clearInterval(heartbeat)
		leaderboardEmitter.removeListener(LEADERBOARD_UPDATE_EVENT, onUpdate)
		res.end()
	})
}
