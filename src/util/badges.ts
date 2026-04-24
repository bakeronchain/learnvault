import { BADGE_DEFINITIONS, type BadgeDefinition } from "../constants/reputation"
import type { BadgeType, UserBadge, BadgeDisplayData } from "../types/gamification"

/**
 * Checks if a user has earned a specific badge based on their stats.
 */
export function checkBadgeEligibility(
	type: BadgeType,
	stats: BadgeEligibilityStats,
): boolean {
	switch (type) {
		case "first_milestone":
			return stats.milestonesCompleted >= 1
		case "ten_milestones":
			return stats.milestonesCompleted >= 10
		case "top_10_leaderboard":
			return stats.leaderboardRank !== null && stats.leaderboardRank <= 10
		case "governance_voter":
			return stats.votesCast >= 1
		default:
			return false
	}
}

/**
 * Stats required to check badge eligibility.
 */
export interface BadgeEligibilityStats {
	milestonesCompleted: number
	leaderboardRank: number | null
	votesCast: number
}

/**
 * Returns all badges a user has earned based on their stats.
 */
export function getEarnedBadges(stats: BadgeEligibilityStats): BadgeType[] {
	const badgeTypes = Object.keys(BADGE_DEFINITIONS) as BadgeType[]
	return badgeTypes.filter((type) => checkBadgeEligibility(type, stats))
}

/**
 * Returns badge display data including earned status and unlock hints.
 */
export function getBadgeDisplayData(
	type: BadgeType,
	earnedBadges: UserBadge[],
): BadgeDisplayData {
	const definition = BADGE_DEFINITIONS[type]
	const earnedBadge = earnedBadges.find((b) => b.type === type)
	const isEarned = earnedBadge !== undefined

	const unlockHints: Record<BadgeType, string> = {
		first_milestone: "Complete your first milestone to unlock",
		ten_milestones: "Complete 10 milestones to unlock",
		top_10_leaderboard: "Reach top 10 on the leaderboard to unlock",
		governance_voter: "Cast a governance vote to unlock",
	}

	return {
		type,
		name: definition.name,
		description: definition.description,
		icon: definition.icon,
		color: definition.color,
		rarity: definition.rarity,
		isEarned,
		earnedAt: earnedBadge?.earnedAt,
		unlockHint: unlockHints[type],
	}
}

/**
 * Returns badges sorted by rarity and earned status.
 * Earned badges first, then by rarity (legendary > rare > uncommon > common).
 */
export function sortBadges(badges: BadgeDisplayData[]): BadgeDisplayData[] {
	const rarityOrder: Record<string, number> = {
		legendary: 0,
		rare: 1,
		uncommon: 2,
		common: 3,
	}

	return [...badges].sort((a, b) => {
		// Earned badges first
		if (a.isEarned && !b.isEarned) return -1
		if (!a.isEarned && b.isEarned) return 1

		// Then by rarity
		return rarityOrder[a.rarity] - rarityOrder[b.rarity]
	})
}

/**
 * Checks if a user should receive any new badges based on updated stats.
 * Returns the new badges earned.
 */
export function checkNewBadges(
	oldStats: BadgeEligibilityStats,
	newStats: BadgeEligibilityStats,
): BadgeType[] {
	const oldEarned = getEarnedBadges(oldStats)
	const newEarned = getEarnedBadges(newStats)
	return newEarned.filter((badge) => !oldEarned.includes(badge))
}
