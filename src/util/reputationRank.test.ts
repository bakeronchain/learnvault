import { describe, expect, it } from "vitest"
import { getReputationRankFromLrn, lrnBalanceToNumber } from "./reputationRank"

describe("lrnBalanceToNumber", () => {
	it("returns 0 for 0n", () => {
		expect(lrnBalanceToNumber(0n)).toBe(0)
	})

	it("converts small bigint values", () => {
		expect(lrnBalanceToNumber(142n)).toBe(142)
	})
})

describe("getReputationRankFromLrn", () => {
	it("ranks zero balance as newcomer", () => {
		expect(getReputationRankFromLrn(0n)).toEqual({
			tier: "newcomer",
			label: "Newcomer",
		})
	})

	it("ranks 1–99 as committed", () => {
		expect(getReputationRankFromLrn(1n).tier).toBe("committed")
		expect(getReputationRankFromLrn(99n).tier).toBe("committed")
	})

	it("ranks 100–499 as rising_star", () => {
		expect(getReputationRankFromLrn(100n).tier).toBe("rising_star")
		expect(getReputationRankFromLrn(499n).tier).toBe("rising_star")
	})

	it("ranks 500–1999 as top_scholar", () => {
		expect(getReputationRankFromLrn(500n).tier).toBe("top_scholar")
		expect(getReputationRankFromLrn(1999n).tier).toBe("top_scholar")
	})

	it("ranks 2000–9999 as elite", () => {
		expect(getReputationRankFromLrn(2000n).tier).toBe("elite")
		expect(getReputationRankFromLrn(9999n).tier).toBe("elite")
	})

	it("ranks 10000+ as legend", () => {
		expect(getReputationRankFromLrn(10_000n).tier).toBe("legend")
		expect(getReputationRankFromLrn(1_000_000n).tier).toBe("legend")
	})
})
