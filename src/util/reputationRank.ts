/**
 * Maps on-chain LRN (LearnToken) balance to a learner-facing rank tier.
 * Higher balance → higher rank. Thresholds align with milestone-style rewards
 * documented in the LearnToken flow (typical mint amounts in the tens–thousands).
 */

export const REPUTATION_TIERS = [
	"newcomer",
	"committed",
	"rising_star",
	"top_scholar",
	"elite",
	"legend",
] as const

export type ReputationTier = (typeof REPUTATION_TIERS)[number]

export interface ReputationRank {
	tier: ReputationTier
	/** Short label for badges and UI */
	label: string
}

/** Stable numeric amount for comparisons and tests (caps at MAX_SAFE_INTEGER). */
export function lrnBalanceToNumber(balance: bigint): number {
	if (balance <= BigInt(Number.MAX_SAFE_INTEGER)) {
		const n = Number(balance)
		return Number.isFinite(n) ? n : 0
	}
	return Number.MAX_SAFE_INTEGER
}

export function getReputationRankFromLrn(balance: bigint): ReputationRank {
	const n = lrnBalanceToNumber(balance)
	if (n <= 0) return { tier: "newcomer", label: "Newcomer" }
	if (n < 100) return { tier: "committed", label: "Committed" }
	if (n < 500) return { tier: "rising_star", label: "Rising Star" }
	if (n < 2_000) return { tier: "top_scholar", label: "Top Scholar" }
	if (n < 10_000) return { tier: "elite", label: "Elite" }
	return { tier: "legend", label: "Legend" }
}
