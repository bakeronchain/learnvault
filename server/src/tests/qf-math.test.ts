// ---------------------------------------------------------------------------
// Quadratic-funding math unit tests.
// Pure functions — no DB, network or SDK. Verifies the QF formula against known
// fixtures, unique-donor weighting, and that a finalized plan sums to the pool.
// ---------------------------------------------------------------------------

import {
	buildDisbursementPlan,
	computeMatchWeight,
	computeStandings,
	roundUsdc,
	type QfContribution,
} from "../lib/qf"

describe("computeMatchWeight — (Σ√c)² − Σc", () => {
	it("is 0 for a single donor (no crowd amplification)", () => {
		// (√100)² − 100 = 100 − 100 = 0
		expect(computeMatchWeight([100])).toBe(0)
	})

	it("rewards many small donors over one large donor", () => {
		// Four donors of 25 each: (4·√25)² − 100 = (20)² − 100 = 400 − 100 = 300
		expect(computeMatchWeight([25, 25, 25, 25])).toBe(300)
		// One donor of 100: weight 0. The crowd is worth far more.
		expect(computeMatchWeight([100])).toBe(0)
	})

	it("matches the classic 1+1+1+1 fixture", () => {
		// (4·√1)² − 4 = 16 − 4 = 12
		expect(computeMatchWeight([1, 1, 1, 1])).toBe(12)
	})

	it("ignores non-positive amounts", () => {
		expect(computeMatchWeight([25, 0, -5, 25])).toBe(computeMatchWeight([25, 25]))
	})

	it("never returns a negative weight", () => {
		expect(computeMatchWeight([0.0000001])).toBeGreaterThanOrEqual(0)
	})
})

describe("computeStandings", () => {
	it("aggregates multiple contributions from the same donor before sqrt", () => {
		// Donor A gives 25 twice = 50 effective; Donor B gives 50 once.
		// Per-donor amounts: [50, 50] → weight (2√50)² − 100 = 200 − 100 = 100
		const contributions: QfContribution[] = [
			{ proposalId: 1, donorAddr: "A", amount: 25 },
			{ proposalId: 1, donorAddr: "A", amount: 25 },
			{ proposalId: 1, donorAddr: "B", amount: 50 },
		]
		const [standing] = computeStandings(contributions, 1000)
		expect(standing.uniqueContributors).toBe(2)
		expect(standing.totalContributions).toBe(100)
		expect(standing.matchWeight).toBeCloseTo(100, 6)
	})

	it("weights the proposal with more unique donors higher for equal totals", () => {
		// Proposal 1: 100 from a single donor → weight 0
		// Proposal 2: 100 from four donors of 25 → weight 300
		const contributions: QfContribution[] = [
			{ proposalId: 1, donorAddr: "whale", amount: 100 },
			{ proposalId: 2, donorAddr: "a", amount: 25 },
			{ proposalId: 2, donorAddr: "b", amount: 25 },
			{ proposalId: 2, donorAddr: "c", amount: 25 },
			{ proposalId: 2, donorAddr: "d", amount: 25 },
		]
		const standings = computeStandings(contributions, 1000)
		const p1 = standings.find((s) => s.proposalId === 1)!
		const p2 = standings.find((s) => s.proposalId === 2)!

		expect(p1.totalContributions).toBe(p2.totalContributions) // equal raised
		expect(p2.uniqueContributors).toBeGreaterThan(p1.uniqueContributors)
		expect(p2.estimatedMatch).toBeGreaterThan(p1.estimatedMatch)
		// Proposal 1 has zero weight so it receives no match; the whole pool
		// flows to proposal 2.
		expect(p1.estimatedMatch).toBe(0)
		expect(p2.estimatedMatch).toBeCloseTo(1000, 6)
	})

	it("normalizes estimated matches to the matching pool", () => {
		const contributions: QfContribution[] = [
			{ proposalId: 1, donorAddr: "a", amount: 10 },
			{ proposalId: 1, donorAddr: "b", amount: 10 },
			{ proposalId: 2, donorAddr: "c", amount: 40 },
			{ proposalId: 2, donorAddr: "d", amount: 40 },
			{ proposalId: 2, donorAddr: "e", amount: 40 },
		]
		const pool = 5000
		const standings = computeStandings(contributions, pool)
		const total = standings.reduce((sum, s) => sum + s.estimatedMatch, 0)
		expect(total).toBeCloseTo(pool, 4)
	})

	it("returns zero matches when there are no contributions", () => {
		expect(computeStandings([], 1000)).toEqual([])
	})

	it("sorts by estimated match descending", () => {
		const contributions: QfContribution[] = [
			{ proposalId: 1, donorAddr: "a", amount: 1 },
			{ proposalId: 1, donorAddr: "b", amount: 1 },
			{ proposalId: 2, donorAddr: "c", amount: 1 },
			{ proposalId: 2, donorAddr: "d", amount: 1 },
			{ proposalId: 2, donorAddr: "e", amount: 1 },
			{ proposalId: 2, donorAddr: "f", amount: 1 },
		]
		const standings = computeStandings(contributions, 1000)
		for (let i = 1; i < standings.length; i++) {
			expect(standings[i - 1].estimatedMatch).toBeGreaterThanOrEqual(
				standings[i].estimatedMatch,
			)
		}
	})
})

describe("buildDisbursementPlan", () => {
	it("produces a plan whose matches sum exactly to the pool", () => {
		const contributions: QfContribution[] = [
			{ proposalId: 1, donorAddr: "a", amount: 33 },
			{ proposalId: 1, donorAddr: "b", amount: 33 },
			{ proposalId: 1, donorAddr: "c", amount: 34 },
			{ proposalId: 2, donorAddr: "d", amount: 10 },
			{ proposalId: 2, donorAddr: "e", amount: 90 },
			{ proposalId: 3, donorAddr: "f", amount: 7 },
			{ proposalId: 3, donorAddr: "g", amount: 11 },
			{ proposalId: 3, donorAddr: "h", amount: 13 },
		]
		const pool = 10000
		const plan = buildDisbursementPlan(contributions, pool)

		const sum = plan.entries.reduce((s, e) => s + e.matchAmount, 0)
		expect(roundUsdc(sum)).toBe(roundUsdc(pool))
		expect(plan.totalMatched).toBe(roundUsdc(pool))
	})

	it("never disburses more than the pool", () => {
		const contributions: QfContribution[] = [
			{ proposalId: 1, donorAddr: "a", amount: 5 },
			{ proposalId: 1, donorAddr: "b", amount: 5 },
			{ proposalId: 2, donorAddr: "c", amount: 5 },
			{ proposalId: 2, donorAddr: "d", amount: 5 },
		]
		const pool = 100
		const plan = buildDisbursementPlan(contributions, pool)
		const sum = plan.entries.reduce((s, e) => s + e.matchAmount, 0)
		expect(sum).toBeLessThanOrEqual(pool + 1e-6)
	})

	it("disburses nothing when no proposal has positive weight", () => {
		// Single donor per proposal → all weights 0.
		const contributions: QfContribution[] = [
			{ proposalId: 1, donorAddr: "a", amount: 100 },
			{ proposalId: 2, donorAddr: "b", amount: 200 },
		]
		const plan = buildDisbursementPlan(contributions, 5000)
		expect(plan.totalMatched).toBe(0)
		for (const entry of plan.entries) {
			expect(entry.matchAmount).toBe(0)
		}
	})

	it("produces an empty plan for a round with no contributions", () => {
		const plan = buildDisbursementPlan([], 5000)
		expect(plan.entries).toEqual([])
		expect(plan.totalMatched).toBe(0)
		expect(plan.matchingPool).toBe(5000)
	})

	it("carries unique contributor counts into the plan", () => {
		const contributions: QfContribution[] = [
			{ proposalId: 1, donorAddr: "a", amount: 10 },
			{ proposalId: 1, donorAddr: "b", amount: 10 },
			{ proposalId: 1, donorAddr: "c", amount: 10 },
		]
		const plan = buildDisbursementPlan(contributions, 1000)
		const entry = plan.entries.find((e) => e.proposalId === 1)!
		expect(entry.uniqueContributors).toBe(3)
		expect(entry.totalContributions).toBe(30)
	})
})
