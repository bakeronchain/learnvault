import type { ReputationTier, BadgeType } from "../types/gamification"

/**
 * Reputation tier configuration with 6 tiers.
 * Each tier defines a name, display color, and LRN threshold range.
 */
export const REPUTATION_TIERS: readonly ReputationTier[] = [
	{ id: "newcomer", name: "Newcomer", color: "#9ca3af", minLrn: 0, maxLrn: 49 },
	{ id: "explorer", name: "Explorer", color: "#b45309", minLrn: 50, maxLrn: 199 },
	{ id: "builder", name: "Builder", color: "#6b7280", minLrn: 200, maxLrn: 499 },
	{ id: "architect", name: "Architect", color: "#d97706", minLrn: 500, maxLrn: 999 },
	{ id: "luminary", name: "Luminary", color: "#7c3aed", minLrn: 1000, maxLrn: 2499 },
	{ id: "visionary", name: "Visionary", color: "#ec4899", minLrn: 2500, maxLrn: Infinity },
] as const

/**
 * Badge definitions for gamification achievements.
 */
export const BADGE_DEFINITIONS: Record<BadgeType, BadgeDefinition> = {
	first_milestone: {
		id: "first_milestone",
		name: "First Steps",
		description: "Completed your first milestone",
		icon: "🎯",
		color: "#22c55e",
		rarity: "common",
	},
	ten_milestones: {
		id: "ten_milestones",
		name: "Dedicated Learner",
		description: "Completed 10 milestones",
		icon: "🏆",
		color: "#3b82f6",
		rarity: "uncommon",
	},
	top_10_leaderboard: {
		id: "top_10_leaderboard",
		name: "Top Scholar",
		description: "Ranked in the top 10 on the leaderboard",
		icon: "🌟",
		color: "#eab308",
		rarity: "rare",
	},
	governance_voter: {
		id: "governance_voter",
		name: "Citizen",
		description: "Cast a governance vote",
		icon: "🗳️",
		color: "#a855f7",
		rarity: "common",
	},
} as const

export interface BadgeDefinition {
	id: BadgeType
	name: string
	description: string
	icon: string
	color: string
	rarity: "common" | "uncommon" | "rare" | "legendary"
}

/**
 * Returns the reputation tier for a given LRN balance.
 */
export function getRank(lrn: number): ReputationTier {
	const safeLrn = Number.isFinite(lrn) ? Math.max(0, lrn) : 0
	return (
		REPUTATION_TIERS.find(
			(tier) => safeLrn >= tier.minLrn && safeLrn <= tier.maxLrn,
		) ?? REPUTATION_TIERS[0]
	)
}

/**
 * Returns the LRN amount needed to reach the next tier.
 * Returns 0 if already at the maximum tier.
 */
export function getLrnToNextRank(lrn: number): number {
	const safeLrn = Number.isFinite(lrn) ? Math.max(0, lrn) : 0
	const currentTierIndex = REPUTATION_TIERS.findIndex(
		(tier) => safeLrn >= tier.minLrn && safeLrn <= tier.maxLrn,
	)

	if (currentTierIndex < 0 || currentTierIndex >= REPUTATION_TIERS.length - 1) {
		return 0
	}

	const nextTier = REPUTATION_TIERS[currentTierIndex + 1]
	if (!nextTier) return 0
	return Math.max(0, nextTier.minLrn - safeLrn)
}

/**
 * Returns the current tier index for progress calculations.
 */
export function getCurrentTierIndex(lrn: number): number {
	const safeLrn = Number.isFinite(lrn) ? Math.max(0, lrn) : 0
	const index = REPUTATION_TIERS.findIndex(
		(tier) => safeLrn >= tier.minLrn && safeLrn <= tier.maxLrn,
	)
	return index >= 0 ? index : 0
}

/**
 * Calculates the progress percentage toward the next tier (0-100).
 * Returns 100 if at maximum tier.
 */
export function getTierProgress(lrn: number): number {
	const safeLrn = Number.isFinite(lrn) ? Math.max(0, lrn) : 0
	const currentTierIndex = getCurrentTierIndex(safeLrn)

	if (currentTierIndex >= REPUTATION_TIERS.length - 1) {
		return 100
	}

	const currentTier = REPUTATION_TIERS[currentTierIndex]
	const nextTier = REPUTATION_TIERS[currentTierIndex + 1]

	if (!currentTier || !nextTier) return 0

	const range = nextTier.minLrn - currentTier.minLrn
	const progress = safeLrn - currentTier.minLrn

	return Math.min(100, Math.max(0, Math.round((progress / range) * 100)))
}

/**
 * Returns the next tier info for display purposes.
 */
export function getNextTier(lrn: number): ReputationTier | null {
	const safeLrn = Number.isFinite(lrn) ? Math.max(0, lrn) : 0
	const currentTierIndex = getCurrentTierIndex(safeLrn)

	if (currentTierIndex >= REPUTATION_TIERS.length - 1) {
		return null
	}

	return REPUTATION_TIERS[currentTierIndex + 1] ?? null
}
