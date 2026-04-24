/**
 * Gamification system types for reputation tiers and badges.
 */

/**
 * Reputation tier definition with visual and threshold data.
 */
export interface ReputationTier {
	id: string
	name: string
	color: string
	minLrn: number
	maxLrn: number
}

/**
 * Badge types representing different achievements.
 */
export type BadgeType =
	| "first_milestone"
	| "ten_milestones"
	| "top_10_leaderboard"
	| "governance_voter"

/**
 * User's badge state - whether earned and when.
 */
export interface UserBadge {
	type: BadgeType
	earnedAt: Date
}

/**
 * Badge display data with earned status.
 */
export interface BadgeDisplayData {
	type: BadgeType
	name: string
	description: string
	icon: string
	color: string
	rarity: "common" | "uncommon" | "rare" | "legendary"
	isEarned: boolean
	earnedAt?: Date
	unlockHint: string
}

/**
 * Tier progression state for display.
 */
export interface TierProgress {
	currentLrn: number
	currentTier: ReputationTier
	nextTier: ReputationTier | null
	lrnToNext: number
	progressPercent: number
	isMaxTier: boolean
}

/**
 * Tier up event data for celebration.
 */
export interface TierUpEvent {
	previousTier: ReputationTier
	newTier: ReputationTier
	previousLrn: number
	newLrn: number
}
