/**
 * Quadratic-funding math.
 *
 * Pure, dependency-free functions so the QF formula can be unit-tested against
 * known fixtures and reused by both the live standings estimator and the
 * finalize disbursement planner.
 *
 * The quadratic-funding match for a proposal is:
 *
 *     matchWeight = (Σ √contribution)² − Σ contribution
 *
 * where the sum runs over the *per-donor* aggregated contribution amounts.
 * Aggregating per donor first (rather than per contribution) is what makes the
 * mechanism reward the *number of unique donors* over raw amount — a whale who
 * splits a large donation across many transactions gains nothing, while many
 * small distinct donors amplify the weight.
 *
 * The raw match weights are then normalized so the total distributed equals the
 * matching pool:
 *
 *     match_i = pool * matchWeight_i / Σ matchWeight
 */

export interface QfContribution {
	proposalId: number
	donorAddr: string
	amount: number
}

export interface ProposalStanding {
	proposalId: number
	/** Total raised directly from donors (sum of contributions). */
	totalContributions: number
	/** Number of distinct donor addresses. */
	uniqueContributors: number
	/** Un-normalized quadratic match weight: (Σ√c)² − Σc. */
	matchWeight: number
	/** Estimated match from the pool, normalized across all proposals. */
	estimatedMatch: number
}

/**
 * Aggregates contributions per (proposal, donor). Multiple contributions from
 * the same donor to the same proposal are summed into a single effective
 * contribution before the square root is applied — this is essential for the
 * QF property that unique donors, not transaction count, drive the match.
 */
function aggregatePerDonor(
	contributions: QfContribution[],
): Map<number, Map<string, number>> {
	const byProposal = new Map<number, Map<string, number>>()

	for (const c of contributions) {
		if (!(c.amount > 0)) continue // ignore zero / negative / NaN amounts
		let donors = byProposal.get(c.proposalId)
		if (!donors) {
			donors = new Map<string, number>()
			byProposal.set(c.proposalId, donors)
		}
		donors.set(c.donorAddr, (donors.get(c.donorAddr) ?? 0) + c.amount)
	}

	return byProposal
}

/**
 * Computes the un-normalized quadratic match weight for a single proposal from
 * its per-donor aggregated amounts:  (Σ√c)² − Σc.
 *
 * The weight is clamped at 0 — floating-point rounding can make it marginally
 * negative when a proposal has a single donor (where the ideal value is
 * exactly 0).
 */
export function computeMatchWeight(donorAmounts: number[]): number {
	let sumSqrt = 0
	let sum = 0
	for (const amount of donorAmounts) {
		if (!(amount > 0)) continue
		sumSqrt += Math.sqrt(amount)
		sum += amount
	}
	const weight = sumSqrt * sumSqrt - sum
	// Clamp to 0 with a relative tolerance: a single donor yields an ideal
	// weight of exactly 0, but floating-point rounding of √x·√x can leave a
	// negligible positive (or negative) residue that would otherwise capture
	// the whole pool. The residue scales with `sum`, so the tolerance does too.
	const tolerance = sum * 1e-9
	return weight > tolerance ? weight : 0
}

/**
 * Computes standings for every proposal in a round, including the normalized
 * estimated match bounded by the matching pool.
 *
 * @param contributions all contributions in the round
 * @param matchingPool  the total pool to distribute (must be >= 0)
 * @returns standings sorted by estimated match (desc), then proposalId (asc)
 */
export function computeStandings(
	contributions: QfContribution[],
	matchingPool: number,
): ProposalStanding[] {
	const pool = matchingPool > 0 ? matchingPool : 0
	const byProposal = aggregatePerDonor(contributions)

	const partial: Omit<ProposalStanding, "estimatedMatch">[] = []
	let totalWeight = 0

	for (const [proposalId, donors] of byProposal) {
		const donorAmounts = [...donors.values()]
		const matchWeight = computeMatchWeight(donorAmounts)
		const totalContributions = donorAmounts.reduce((a, b) => a + b, 0)
		totalWeight += matchWeight
		partial.push({
			proposalId,
			totalContributions,
			uniqueContributors: donors.size,
			matchWeight,
		})
	}

	const standings: ProposalStanding[] = partial.map((p) => ({
		...p,
		estimatedMatch:
			totalWeight > 0 ? (pool * p.matchWeight) / totalWeight : 0,
	}))

	standings.sort(
		(a, b) =>
			b.estimatedMatch - a.estimatedMatch || a.proposalId - b.proposalId,
	)

	return standings
}

export interface DisbursementEntry {
	proposalId: number
	/** Direct contributions raised by the proposal. */
	totalContributions: number
	uniqueContributors: number
	matchWeight: number
	/** Final matched amount from the pool. */
	matchAmount: number
}

export interface DisbursementPlan {
	matchingPool: number
	/** Sum of all matchAmount values — bounded by (and, when weight > 0, equal to) the pool. */
	totalMatched: number
	entries: DisbursementEntry[]
}

/**
 * Produces a finalized disbursement plan for a round. Match amounts are rounded
 * to 7 decimal places (USDC precision on Stellar) and the largest entry absorbs
 * any rounding remainder so the plan sums exactly to the distributed total and
 * never exceeds the pool.
 */
export function buildDisbursementPlan(
	contributions: QfContribution[],
	matchingPool: number,
): DisbursementPlan {
	const pool = matchingPool > 0 ? matchingPool : 0
	const standings = computeStandings(contributions, pool)

	const entries: DisbursementEntry[] = standings.map((s) => ({
		proposalId: s.proposalId,
		totalContributions: s.totalContributions,
		uniqueContributors: s.uniqueContributors,
		matchWeight: s.matchWeight,
		matchAmount: roundUsdc(s.estimatedMatch),
	}))

	// If nothing has positive weight, no match is distributed.
	const distributable = entries.some((e) => e.matchWeight > 0) ? pool : 0

	let totalMatched = entries.reduce((sum, e) => sum + e.matchAmount, 0)

	// Reconcile rounding drift against the distributable total so the plan is
	// bounded by the pool and sums exactly. Apply the correction to the largest
	// entry (which can absorb it without going negative).
	const drift = roundUsdc(distributable - totalMatched)
	if (drift !== 0 && entries.length > 0) {
		const largest = entries.reduce((max, e) =>
			e.matchAmount > max.matchAmount ? e : max,
		)
		largest.matchAmount = roundUsdc(largest.matchAmount + drift)
		if (largest.matchAmount < 0) largest.matchAmount = 0
		totalMatched = entries.reduce((sum, e) => sum + e.matchAmount, 0)
	}

	return {
		matchingPool: pool,
		totalMatched: roundUsdc(totalMatched),
		entries,
	}
}

/** Rounds to 7 decimal places (USDC atomic precision on Stellar). */
export function roundUsdc(value: number): number {
	return Math.round(value * 1e7) / 1e7
}
