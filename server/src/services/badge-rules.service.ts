import { pool } from "../db/index"
import { badgeService, BADGE_TYPES } from "./badge.service"
import { milestoneStore } from "../db/milestone-store"
import { logger } from "../lib/logger"

const log = logger.child({ module: "badge-rules" })

export interface BadgeRuleEvaluation {
	badgeType: string
	eligible: boolean
	reason?: string
}

/**
 * Check if a learner has completed their first course
 */
async function checkFirstCompletion(learnerAddress: string): Promise<BadgeRuleEvaluation> {
	try {
		// Check if learner has any completed courses
		const result = await pool.query(
			`SELECT DISTINCT course_id 
			 FROM milestone_approvals 
			 WHERE scholar_address = $1 AND status = 'approved'`,
			[learnerAddress],
		)

		if (result.rows.length === 0) {
			return {
				badgeType: BADGE_TYPES.FIRST_COMPLETION,
				eligible: false,
				reason: "No completed courses found",
			}
		}

		// Check if any course is fully completed (all milestones approved)
		for (const row of result.rows) {
			const courseId = row.course_id
			const { totalMilestones, approvedCount } =
				await milestoneStore.getMilestoneProgress(learnerAddress, courseId)

			if (totalMilestones > 0 && approvedCount >= totalMilestones) {
				return {
					badgeType: BADGE_TYPES.FIRST_COMPLETION,
					eligible: true,
				}
			}
		}

		return {
			badgeType: BADGE_TYPES.FIRST_COMPLETION,
			eligible: false,
			reason: "No fully completed courses",
		}
	} catch (error) {
		log.error({ error, learnerAddress }, "Error checking first completion")
		return {
			badgeType: BADGE_TYPES.FIRST_COMPLETION,
			eligible: false,
			reason: "Error checking completion status",
		}
	}
}

/**
 * Check if a learner has a 30-day streak
 * This checks for consecutive days of learning activity
 */
async function checkStreak30(learnerAddress: string): Promise<BadgeRuleEvaluation> {
	try {
		// Check milestone approvals in the last 30 days
		const result = await pool.query(
			`SELECT DATE(approved_at) as activity_date
			 FROM milestone_approvals
			 WHERE scholar_address = $1 
			 AND approved_at >= NOW() - INTERVAL '30 days'
			 GROUP BY DATE(approved_at)
			 ORDER BY activity_date DESC`,
			[learnerAddress],
		)

		if (result.rows.length < 30) {
			return {
				badgeType: BADGE_TYPES.STREAK_30,
				eligible: false,
				reason: `Only ${result.rows.length} days of activity in last 30 days`,
			}
		}

		// Check for consecutive days
		const dates = result.rows.map((row) => new Date(row.activity_date))
		let consecutiveDays = 0
		let maxConsecutiveDays = 0

		for (let i = 0; i < dates.length; i++) {
			if (i === 0) {
				consecutiveDays = 1
			} else {
				const prevDate = dates[i - 1]
				const currDate = dates[i]
				const diffDays = Math.floor(
					(prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24),
				)

				if (diffDays === 1) {
					consecutiveDays++
				} else {
					consecutiveDays = 1
				}
			}

			if (consecutiveDays > maxConsecutiveDays) {
				maxConsecutiveDays = consecutiveDays
			}
		}

		if (maxConsecutiveDays >= 30) {
			return {
				badgeType: BADGE_TYPES.STREAK_30,
				eligible: true,
			}
		}

		return {
			badgeType: BADGE_TYPES.STREAK_30,
			eligible: false,
			reason: `Max consecutive days: ${maxConsecutiveDays}`,
		}
	} catch (error) {
		log.error({ error, learnerAddress }, "Error checking streak")
		return {
			badgeType: BADGE_TYPES.STREAK_30,
			eligible: false,
			reason: "Error checking streak status",
		}
	}
}

/**
 * Check if a learner has funded their first scholarship
 */
async function checkFirstScholarshipFunded(
	learnerAddress: string,
): Promise<BadgeRuleEvaluation> {
	try {
		// Check if learner has made any scholarship deposits
		const result = await pool.query(
			`SELECT COUNT(*) as count
			 FROM scholarship_treasury_deposits
			 WHERE donor_address = $1`,
			[learnerAddress],
		)

		const depositCount = Number.parseInt(result.rows[0]?.count || "0", 10)

		if (depositCount > 0) {
			return {
				badgeType: BADGE_TYPES.FIRST_SCHOLARSHIP_FUNDED,
				eligible: true,
			}
		}

		return {
			badgeType: BADGE_TYPES.FIRST_SCHOLARSHIP_FUNDED,
			eligible: false,
			reason: "No scholarship deposits found",
		}
	} catch (error) {
		log.error({ error, learnerAddress }, "Error checking scholarship funding")
		return {
			badgeType: BADGE_TYPES.FIRST_SCHOLARSHIP_FUNDED,
			eligible: false,
			reason: "Error checking scholarship funding status",
		}
	}
}

/**
 * Check if a learner is in the top 10 leaderboard
 */
async function checkTop10Leaderboard(learnerAddress: string): Promise<BadgeRuleEvaluation> {
	try {
		// Get current leaderboard ranking
		const result = await pool.query(
			`WITH rankings AS (
				SELECT scholar_address, 
				       RANK() OVER (ORDER BY points DESC) as rank
			 FROM leaderboard
			)
			SELECT rank FROM rankings WHERE scholar_address = $1`,
			[learnerAddress],
		)

		if (result.rows.length === 0) {
			return {
				badgeType: BADGE_TYPES.TOP_10_LEADERBOARD,
				eligible: false,
				reason: "Not on leaderboard",
			}
		}

		const rank = Number.parseInt(result.rows[0].rank, 10)

		if (rank <= 10) {
			return {
				badgeType: BADGE_TYPES.TOP_10_LEADERBOARD,
				eligible: true,
			}
		}

		return {
			badgeType: BADGE_TYPES.TOP_10_LEADERBOARD,
			eligible: false,
			reason: `Current rank: ${rank}`,
		}
	} catch (error) {
		log.error({ error, learnerAddress }, "Error checking leaderboard")
		return {
			badgeType: BADGE_TYPES.TOP_10_LEADERBOARD,
			eligible: false,
			reason: "Error checking leaderboard status",
		}
	}
}

/**
 * Evaluate all badge rules for a learner
 */
export async function evaluateBadgeRules(
	learnerAddress: string,
): Promise<BadgeRuleEvaluation[]> {
	const evaluations = await Promise.all([
		checkFirstCompletion(learnerAddress),
		checkStreak30(learnerAddress),
		checkFirstScholarshipFunded(learnerAddress),
		checkTop10Leaderboard(learnerAddress),
	])

	return evaluations
}

/**
 * Process badge awards based on rule evaluation
 * Idempotent - won't award if already has badge
 */
export async function processBadgeAwards(
	learnerAddress: string,
): Promise<{ awarded: string[]; skipped: string[] }> {
	const evaluations = await evaluateBadgeRules(learnerAddress)
	const awarded: string[] = []
	const skipped: string[] = []

	for (const evaluation of evaluations) {
		if (!evaluation.eligible) {
			skipped.push(evaluation.badgeType)
			continue
		}

		// Check if already has badge
		const hasBadge = await badgeService.hasBadge(
			learnerAddress,
			evaluation.badgeType,
		)

		if (hasBadge) {
			skipped.push(evaluation.badgeType)
			continue
		}

		// Attempt to mint badge
		try {
			const result = await badgeService.mintBadge(
				learnerAddress,
				evaluation.badgeType,
			)

			if (result.minted) {
				awarded.push(evaluation.badgeType)
				log.info(
					{ learnerAddress, badgeType: evaluation.badgeType, tokenId: result.tokenId },
					"Badge awarded",
				)
			} else {
				skipped.push(evaluation.badgeType)
			}
		} catch (error) {
			log.error(
				{ error, learnerAddress, badgeType: evaluation.badgeType },
				"Failed to award badge",
			)
			skipped.push(evaluation.badgeType)
		}
	}

	return { awarded, skipped }
}

/**
 * Process badge awards for a specific event type
 * Called by event indexer when specific events occur
 */
export async function processEventBasedBadgeAward(
	learnerAddress: string,
	eventType: string,
): Promise<void> {
	switch (eventType) {
		case "CourseMilestone_MilestoneComplete":
			// Check for first completion badge
			await checkAndAwardBadge(learnerAddress, BADGE_TYPES.FIRST_COMPLETION)
			break
		case "ScholarshipTreasury_Deposit":
			// Check for first scholarship funded badge
			await checkAndAwardBadge(
				learnerAddress,
				BADGE_TYPES.FIRST_SCHOLARSHIP_FUNDED,
			)
			break
		case "Leaderboard_Update":
			// Check for top 10 leaderboard badge
			await checkAndAwardBadge(learnerAddress, BADGE_TYPES.TOP_10_LEADERBOARD)
			break
		default:
			break
	}
}

async function checkAndAwardBadge(
	learnerAddress: string,
	badgeType: string,
): Promise<void> {
	// Check if already has badge
	const hasBadge = await badgeService.hasBadge(learnerAddress, badgeType)
	if (hasBadge) {
		return
	}

	let evaluation: BadgeRuleEvaluation

	switch (badgeType) {
		case BADGE_TYPES.FIRST_COMPLETION:
			evaluation = await checkFirstCompletion(learnerAddress)
			break
		case BADGE_TYPES.STREAK_30:
			evaluation = await checkStreak30(learnerAddress)
			break
		case BADGE_TYPES.FIRST_SCHOLARSHIP_FUNDED:
			evaluation = await checkFirstScholarshipFunded(learnerAddress)
			break
		case BADGE_TYPES.TOP_10_LEADERBOARD:
			evaluation = await checkTop10Leaderboard(learnerAddress)
			break
		default:
			return
	}

	if (evaluation.eligible) {
		try {
			const result = await badgeService.mintBadge(learnerAddress, badgeType)
			if (result.minted) {
				log.info(
					{ learnerAddress, badgeType, tokenId: result.tokenId },
					"Badge awarded from event",
				)
			}
		} catch (error) {
			log.error({ error, learnerAddress, badgeType }, "Failed to award badge from event")
		}
	}
}

export const badgeRulesService = {
	evaluateBadgeRules,
	processBadgeAwards,
	processEventBasedBadgeAward,
	checkFirstCompletion,
	checkStreak30,
	checkFirstScholarshipFunded,
	checkTop10Leaderboard,
}
