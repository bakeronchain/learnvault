/**
 * Unit tests for the learning streak service. Uses a mocked pool so no
 * database is required; query results are routed by matching on the SQL
 * text so tests don't depend on call ordering.
 */

jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn(),
		connect: jest.fn(),
	},
}))

jest.mock("../services/learn-token.service", () => ({
	learnTokenService: {
		mintLearnTokenBonus: jest.fn().mockResolvedValue({ txHash: "mock_hash" }),
	},
}))

import { pool } from "../db/index"
import { learnTokenService } from "../services/learn-token.service"
import {
	getStreakSummary,
	recordMilestoneActivity,
} from "../services/streak.service"

const mockQuery = pool.query as jest.Mock

function isoDate(daysAgo: number): string {
	const d = new Date()
	d.setUTCDate(d.getUTCDate() - daysAgo)
	return d.toISOString().slice(0, 10)
}

beforeEach(() => {
	jest.clearAllMocks()
})

describe("recordMilestoneActivity", () => {
	it("starts a new streak at 1 for a first-time learner", async () => {
		mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
			if (sql.includes("INSERT INTO streak_activity")) {
				return Promise.resolve({ rows: [] })
			}
			if (sql.startsWith("SELECT learner_address, current_streak")) {
				return Promise.resolve({ rows: [] })
			}
			if (sql.includes("INSERT INTO learner_streaks")) {
				const [
					learner_address,
					current_streak,
					longest_streak,
					last_active_date,
					daily_goal,
				] = params as [string, number, number, string, number]
				return Promise.resolve({
					rows: [
						{
							learner_address,
							current_streak,
							longest_streak,
							last_active_date,
							daily_goal,
							updated_at: new Date().toISOString(),
						},
					],
				})
			}
			return Promise.resolve({ rows: [] })
		})

		const { streak, bonusThreshold } =
			await recordMilestoneActivity("GLEARNER1")

		expect(streak.current_streak).toBe(1)
		expect(streak.longest_streak).toBe(1)
		expect(bonusThreshold).toBeNull()
	})

	it("increments the streak when yesterday was active", async () => {
		mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
			if (sql.includes("INSERT INTO streak_activity")) {
				return Promise.resolve({ rows: [] })
			}
			if (sql.startsWith("SELECT learner_address, current_streak")) {
				return Promise.resolve({
					rows: [
						{
							learner_address: "GLEARNER1",
							current_streak: 3,
							longest_streak: 5,
							last_active_date: isoDate(1),
							daily_goal: 1,
						},
					],
				})
			}
			if (sql.includes("INSERT INTO learner_streaks")) {
				const [
					learner_address,
					current_streak,
					longest_streak,
					last_active_date,
					daily_goal,
				] = params as [string, number, number, string, number]
				return Promise.resolve({
					rows: [
						{
							learner_address,
							current_streak,
							longest_streak,
							last_active_date,
							daily_goal,
							updated_at: new Date().toISOString(),
						},
					],
				})
			}
			return Promise.resolve({ rows: [] })
		})

		const { streak, bonusThreshold } =
			await recordMilestoneActivity("GLEARNER1")

		expect(streak.current_streak).toBe(4)
		expect(streak.longest_streak).toBe(5)
		expect(bonusThreshold).toBeNull()
	})

	it("resets the current streak but preserves the longest streak after a missed day", async () => {
		mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
			if (sql.includes("INSERT INTO streak_activity")) {
				return Promise.resolve({ rows: [] })
			}
			if (sql.startsWith("SELECT learner_address, current_streak")) {
				return Promise.resolve({
					rows: [
						{
							learner_address: "GLEARNER1",
							current_streak: 10,
							longest_streak: 15,
							last_active_date: isoDate(3),
							daily_goal: 2,
						},
					],
				})
			}
			if (sql.includes("INSERT INTO learner_streaks")) {
				const [
					learner_address,
					current_streak,
					longest_streak,
					last_active_date,
					daily_goal,
				] = params as [string, number, number, string, number]
				return Promise.resolve({
					rows: [
						{
							learner_address,
							current_streak,
							longest_streak,
							last_active_date,
							daily_goal,
							updated_at: new Date().toISOString(),
						},
					],
				})
			}
			return Promise.resolve({ rows: [] })
		})

		const { streak, bonusThreshold } =
			await recordMilestoneActivity("GLEARNER1")

		expect(streak.current_streak).toBe(1)
		expect(streak.longest_streak).toBe(15)
		expect(streak.daily_goal).toBe(2)
		expect(bonusThreshold).toBeNull()
	})

	it("does not change the streak on a second milestone the same day", async () => {
		const today = isoDate(0)
		mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
			if (sql.includes("INSERT INTO streak_activity")) {
				return Promise.resolve({ rows: [] })
			}
			if (sql.startsWith("SELECT learner_address, current_streak")) {
				return Promise.resolve({
					rows: [
						{
							learner_address: "GLEARNER1",
							current_streak: 6,
							longest_streak: 6,
							last_active_date: today,
							daily_goal: 1,
						},
					],
				})
			}
			if (sql.includes("INSERT INTO learner_streaks")) {
				const [
					learner_address,
					current_streak,
					longest_streak,
					last_active_date,
					daily_goal,
				] = params as [string, number, number, string, number]
				return Promise.resolve({
					rows: [
						{
							learner_address,
							current_streak,
							longest_streak,
							last_active_date,
							daily_goal,
							updated_at: new Date().toISOString(),
						},
					],
				})
			}
			return Promise.resolve({ rows: [] })
		})

		const { streak, bonusThreshold } =
			await recordMilestoneActivity("GLEARNER1")

		expect(streak.current_streak).toBe(6)
		expect(streak.longest_streak).toBe(6)
		expect(bonusThreshold).toBeNull()
	})

	it("triggers exactly one bonus when the streak newly crosses the 7-day threshold", async () => {
		mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
			if (sql.includes("INSERT INTO streak_activity")) {
				return Promise.resolve({ rows: [] })
			}
			if (sql.startsWith("SELECT learner_address, current_streak")) {
				return Promise.resolve({
					rows: [
						{
							learner_address: "GLEARNER1",
							current_streak: 6,
							longest_streak: 6,
							last_active_date: isoDate(1),
							daily_goal: 1,
						},
					],
				})
			}
			if (sql.includes("INSERT INTO learner_streaks")) {
				const [
					learner_address,
					current_streak,
					longest_streak,
					last_active_date,
					daily_goal,
				] = params as [string, number, number, string, number]
				return Promise.resolve({
					rows: [
						{
							learner_address,
							current_streak,
							longest_streak,
							last_active_date,
							daily_goal,
							updated_at: new Date().toISOString(),
						},
					],
				})
			}
			return Promise.resolve({ rows: [] })
		})

		const { streak, bonusThreshold } =
			await recordMilestoneActivity("GLEARNER1")

		expect(streak.current_streak).toBe(7)
		expect(bonusThreshold).toBe(7)
		// mint is fire-and-forget (void); flush microtasks before asserting.
		await new Promise((resolve) => setImmediate(resolve))
		expect(learnTokenService.mintLearnTokenBonus).toHaveBeenCalledTimes(1)
		expect(learnTokenService.mintLearnTokenBonus).toHaveBeenCalledWith(
			"GLEARNER1",
			50_000_000n,
		)
	})

	it("does not re-trigger the 7-day bonus once longest_streak has already passed it", async () => {
		mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
			if (sql.includes("INSERT INTO streak_activity")) {
				return Promise.resolve({ rows: [] })
			}
			if (sql.startsWith("SELECT learner_address, current_streak")) {
				// Streak was broken and rebuilt, but longest_streak already covers 7.
				return Promise.resolve({
					rows: [
						{
							learner_address: "GLEARNER1",
							current_streak: 6,
							longest_streak: 12,
							last_active_date: isoDate(1),
							daily_goal: 1,
						},
					],
				})
			}
			if (sql.includes("INSERT INTO learner_streaks")) {
				const [
					learner_address,
					current_streak,
					longest_streak,
					last_active_date,
					daily_goal,
				] = params as [string, number, number, string, number]
				return Promise.resolve({
					rows: [
						{
							learner_address,
							current_streak,
							longest_streak,
							last_active_date,
							daily_goal,
							updated_at: new Date().toISOString(),
						},
					],
				})
			}
			return Promise.resolve({ rows: [] })
		})

		const { bonusThreshold } = await recordMilestoneActivity("GLEARNER1")

		expect(bonusThreshold).toBeNull()
		await new Promise((resolve) => setImmediate(resolve))
		expect(learnTokenService.mintLearnTokenBonus).not.toHaveBeenCalled()
	})
})

describe("getStreakSummary", () => {
	it("reports goal_met when today's progress meets the daily goal", async () => {
		mockQuery.mockImplementation((sql: string) => {
			if (sql.startsWith("SELECT learner_address, current_streak")) {
				return Promise.resolve({
					rows: [
						{
							learner_address: "GLEARNER1",
							current_streak: 4,
							longest_streak: 9,
							last_active_date: isoDate(0),
							daily_goal: 2,
						},
					],
				})
			}
			if (sql.includes("SELECT milestones_done FROM streak_activity")) {
				return Promise.resolve({ rows: [{ milestones_done: 2 }] })
			}
			if (sql.includes("SELECT activity_date, milestones_done")) {
				return Promise.resolve({ rows: [] })
			}
			return Promise.resolve({ rows: [] })
		})

		const summary = await getStreakSummary("GLEARNER1")

		expect(summary.current_streak).toBe(4)
		expect(summary.longest_streak).toBe(9)
		expect(summary.todays_progress).toBe(2)
		expect(summary.goal_met).toBe(true)
		expect(summary.last_7_days).toHaveLength(7)
	})

	it("reports goal_met as false when there has been no activity today", async () => {
		mockQuery.mockImplementation((sql: string) => {
			if (sql.startsWith("SELECT learner_address, current_streak")) {
				return Promise.resolve({ rows: [] })
			}
			if (sql.includes("SELECT milestones_done FROM streak_activity")) {
				return Promise.resolve({ rows: [] })
			}
			return Promise.resolve({ rows: [] })
		})

		const summary = await getStreakSummary("GNEWLEARNER")

		expect(summary.current_streak).toBe(0)
		expect(summary.todays_progress).toBe(0)
		expect(summary.goal_met).toBe(false)
	})
})
