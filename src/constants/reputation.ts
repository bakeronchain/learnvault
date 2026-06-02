export const REPUTATION_TIERS = [
	{ min: 0, max: 49, rank: "Newcomer", color: "#9ca3af" },
	{ min: 50, max: 199, rank: "Explorer", color: "#b45309" },
	{ min: 200, max: 499, rank: "Builder", color: "#6b7280" },
	{ min: 500, max: 999, rank: "Architect", color: "#d97706" },
	{ min: 1000, max: Infinity, rank: "Luminary", color: "#7c3aed" },
] as const

export function getRank(lrn: number) {
	const safeLrn = Number.isFinite(lrn) ? Math.max(0, lrn) : 0
	return (
		REPUTATION_TIERS.find(
			(tier) => safeLrn >= tier.min && safeLrn <= tier.max,
		) ?? REPUTATION_TIERS[0]
	)
}

export function getLrnToNextRank(lrn: number) {
	const safeLrn = Number.isFinite(lrn) ? Math.max(0, lrn) : 0
	const currentTierIndex = REPUTATION_TIERS.findIndex(
		(tier) => safeLrn >= tier.min && safeLrn <= tier.max,
	)

	if (currentTierIndex < 0 || currentTierIndex >= REPUTATION_TIERS.length - 1) {
		return 0
	}

	const nextTier = REPUTATION_TIERS[currentTierIndex + 1]
	if (!nextTier) return 0
	return Math.max(0, nextTier.min - safeLrn)
}
