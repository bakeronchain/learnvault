import { Router } from "express"

import { getScholarsLeaderboard } from "../controllers/scholars.controller"

export const scholarsRouter = Router()

scholarsRouter.get("/scholars/leaderboard", (req, res) => {
	void getScholarsLeaderboard(req, res)
})
