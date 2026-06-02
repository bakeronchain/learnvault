import { describe, expect, it } from "vitest"
import { getLrnToNextRank, getRank, REPUTATION_TIERS } from "./reputation"

describe("REPUTATION_TIERS", () => {
	it("defines the expected 5 tier ranges", () => {
		expect(REPUTATION_TIERS).toHaveLength(5)
		expect(REPUTATION_TIERS[0].rank).toBe("Newcomer")
		expect(REPUTATION_TIERS[4].rank).toBe("Luminary")
	})
})

describe("getRank", () => {
	it("returns Newcomer for low balances", () => {
		expect(getRank(0).rank).toBe("Newcomer")
		expect(getRank(49).rank).toBe("Newcomer")
	})

	it("returns Explorer for 50-199", () => {
		expect(getRank(50).rank).toBe("Explorer")
		expect(getRank(199).rank).toBe("Explorer")
	})

	it("returns Builder for 200-499", () => {
		expect(getRank(200).rank).toBe("Builder")
		expect(getRank(499).rank).toBe("Builder")
	})

	it("returns Architect for 500-999", () => {
		expect(getRank(500).rank).toBe("Architect")
		expect(getRank(999).rank).toBe("Architect")
	})

	it("returns Luminary for 1000+", () => {
		expect(getRank(1000).rank).toBe("Luminary")
		expect(getRank(100_000).rank).toBe("Luminary")
	})
})

describe("getLrnToNextRank", () => {
	it("returns remaining LRN to next tier", () => {
		expect(getLrnToNextRank(0)).toBe(50)
		expect(getLrnToNextRank(120)).toBe(80)
		expect(getLrnToNextRank(250)).toBe(250)
		expect(getLrnToNextRank(700)).toBe(300)
	})

	it("returns 0 for top tier", () => {
		expect(getLrnToNextRank(1000)).toBe(0)
		expect(getLrnToNextRank(50_000)).toBe(0)
	})
})
