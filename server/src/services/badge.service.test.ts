import { describe, it, expect, beforeEach, vi } from "vitest"
import { badgeService } from "./badge.service"
import { pool } from "../db/index"

// Mock dependencies
vi.mock("../db/index")
vi.mock("./pinata.service")
vi.mock("./stellar-contract.service")

describe("badgeService", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("hasBadge", () => {
		it("should return true when badge exists", async () => {
			vi.mocked(pool.query).mockResolvedValue({
				rows: [{ id: 1 }],
				rowCount: 1,
			} as never)

			const result = await badgeService.hasBadge(
				"GDABC...",
				badgeService.BADGE_TYPES.FIRST_COMPLETION,
			)

			expect(result).toBe(true)
			expect(pool.query).toHaveBeenCalledWith(
				"SELECT id FROM achievement_badges WHERE learner_addr = $1 AND badge_type = $2",
				["GDABC...", badgeService.BADGE_TYPES.FIRST_COMPLETION],
			)
		})

		it("should return false when badge does not exist", async () => {
			vi.mocked(pool.query).mockResolvedValue({
				rows: [],
				rowCount: 0,
			} as never)

			const result = await badgeService.hasBadge(
				"GDABC...",
				badgeService.BADGE_TYPES.FIRST_COMPLETION,
			)

			expect(result).toBe(false)
		})
	})

	describe("getAllBadgeTypes", () => {
		it("should return all badge types with metadata", async () => {
			const catalog = await badgeService.getAllBadgeTypes()

			expect(catalog).toHaveLength(4)
			expect(catalog.map((b: { badge_type: string }) => b.badge_type)).toEqual([
				badgeService.BADGE_TYPES.FIRST_COMPLETION,
				badgeService.BADGE_TYPES.STREAK_30,
				badgeService.BADGE_TYPES.FIRST_SCHOLARSHIP_FUNDED,
				badgeService.BADGE_TYPES.TOP_10_LEADERBOARD,
			])
		})
	})

	describe("BADGE_TYPES", () => {
		it("should have all expected badge types", () => {
			expect(badgeService.BADGE_TYPES.FIRST_COMPLETION).toBe("first_completion")
			expect(badgeService.BADGE_TYPES.STREAK_30).toBe("streak_30")
			expect(badgeService.BADGE_TYPES.FIRST_SCHOLARSHIP_FUNDED).toBe(
				"first_scholarship_funded",
			)
			expect(badgeService.BADGE_TYPES.TOP_10_LEADERBOARD).toBe("top_10_leaderboard")
		})
	})
})
