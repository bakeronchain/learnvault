import { type Request, type Response } from "express"
import { logger } from "../lib/logger"
import { getStreakSummary, setDailyGoal } from "../services/streak.service"

const log = logger.child({ module: "streaks" })

const MIN_DAILY_GOAL = 1
const MAX_DAILY_GOAL = 20

export async function getStreak(req: Request, res: Response): Promise<void> {
	const { address } = req.params
	if (!address) {
		res.status(400).json({ error: "Learner address is required" })
		return
	}

	try {
		const summary = await getStreakSummary(address)
		res.status(200).json({ data: summary })
	} catch (err) {
		log.error({ err }, "getStreak error")
		res.status(500).json({ error: "Failed to fetch streak" })
	}
}

export async function updateDailyGoal(
	req: Request,
	res: Response,
): Promise<void> {
	const { address } = req.params
	const walletAddress = req.walletAddress

	if (!address) {
		res.status(400).json({ error: "Learner address is required" })
		return
	}
	if (!walletAddress || walletAddress !== address) {
		res.status(403).json({ error: "You can only update your own daily goal" })
		return
	}

	const { dailyGoal } = req.body as { dailyGoal?: unknown }
	if (
		typeof dailyGoal !== "number" ||
		!Number.isInteger(dailyGoal) ||
		dailyGoal < MIN_DAILY_GOAL ||
		dailyGoal > MAX_DAILY_GOAL
	) {
		res.status(400).json({
			error: `dailyGoal must be an integer between ${MIN_DAILY_GOAL} and ${MAX_DAILY_GOAL}`,
		})
		return
	}

	try {
		const streak = await setDailyGoal(address, dailyGoal)
		res.status(200).json({ data: streak })
	} catch (err) {
		log.error({ err }, "updateDailyGoal error")
		res.status(500).json({ error: "Failed to update daily goal" })
	}
}
