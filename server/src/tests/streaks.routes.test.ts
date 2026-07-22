/**
 * Integration tests for the streaks API surface: the public streak-state
 * lookup and the authenticated daily-goal update.
 */

process.env.NODE_ENV = "test"

jest.mock("../services/streak.service", () => ({
	getStreakSummary: jest.fn(),
	setDailyGoal: jest.fn(),
}))

import express from "express"
import request from "supertest"
import { errorHandler } from "../middleware/error.middleware"
import { createStreaksRouter } from "../routes/streaks.routes"
import { type JwtService } from "../services/jwt.service"
import { getStreakSummary, setDailyGoal } from "../services/streak.service"

const testJwtService: JwtService = {
	signWalletToken: () => "mock-token",
	verifyWalletToken: async (_token: string) => ({
		sub: "GLEARNER1",
		jti: "test-jti",
	}),
	revokeToken: async () => {},
	signRefreshToken: () => "mock-refresh-token",
	issueTokenPair: () => ({
		accessToken: "mock-token",
		refreshToken: "mock-refresh-token",
	}),
	verifyRefreshToken: async () => ({ sub: "GLEARNER1", jti: "test-jti" }),
	rotateRefreshToken: async () => ({
		accessToken: "mock-token",
		refreshToken: "mock-refresh-token",
		sub: "GLEARNER1",
	}),
}

function buildApp(): express.Express {
	const app = express()
	app.use(express.json())
	app.use("/api", createStreaksRouter(testJwtService))
	app.use(errorHandler)
	return app
}

const SAMPLE_SUMMARY = {
	current_streak: 4,
	longest_streak: 9,
	daily_goal: 2,
	todays_progress: 1,
	goal_met: false,
	last_7_days: [],
}

beforeEach(() => {
	jest.clearAllMocks()
	;(getStreakSummary as jest.Mock).mockResolvedValue(SAMPLE_SUMMARY)
	;(setDailyGoal as jest.Mock).mockResolvedValue({
		learner_address: "GLEARNER1",
		current_streak: 4,
		longest_streak: 9,
		last_active_date: "2026-07-22",
		daily_goal: 3,
		updated_at: "2026-07-22T00:00:00.000Z",
	})
})

describe("GET /api/streaks/:address", () => {
	it("returns the learner's streak state without requiring auth", async () => {
		const app = buildApp()
		const res = await request(app).get("/api/streaks/GLEARNER1")

		expect(res.status).toBe(200)
		expect(res.body.data).toEqual(SAMPLE_SUMMARY)
		expect(getStreakSummary).toHaveBeenCalledWith("GLEARNER1")
	})
})

describe("PUT /api/streaks/:address/goal", () => {
	it("requires authentication", async () => {
		const app = buildApp()
		const res = await request(app)
			.put("/api/streaks/GLEARNER1/goal")
			.send({ dailyGoal: 3 })

		expect(res.status).toBe(401)
		expect(setDailyGoal).not.toHaveBeenCalled()
	})

	it("rejects updating another learner's daily goal", async () => {
		const app = buildApp()
		const res = await request(app)
			.put("/api/streaks/GSOMEONEELSE/goal")
			.set("Authorization", "Bearer mock-token")
			.send({ dailyGoal: 3 })

		expect(res.status).toBe(403)
		expect(setDailyGoal).not.toHaveBeenCalled()
	})

	it("rejects an out-of-range daily goal", async () => {
		const app = buildApp()
		const res = await request(app)
			.put("/api/streaks/GLEARNER1/goal")
			.set("Authorization", "Bearer mock-token")
			.send({ dailyGoal: 0 })

		expect(res.status).toBe(400)
		expect(setDailyGoal).not.toHaveBeenCalled()
	})

	it("updates the daily goal for the authenticated learner", async () => {
		const app = buildApp()
		const res = await request(app)
			.put("/api/streaks/GLEARNER1/goal")
			.set("Authorization", "Bearer mock-token")
			.send({ dailyGoal: 3 })

		expect(res.status).toBe(200)
		expect(res.body.data.daily_goal).toBe(3)
		expect(setDailyGoal).toHaveBeenCalledWith("GLEARNER1", 3)
	})
})
