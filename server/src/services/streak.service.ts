import { pool } from "../db/index"
import { logger } from "../lib/logger"
import { learnTokenService } from "./learn-token.service"

const log = logger.child({ module: "streak" })

const LRN_ATOMIC_UNIT = 10_000_000n

// Streak-milestone bonuses. Kept small and capped since LRN is soulbound
// reputation — these are a nudge toward consistency, not a farmable reward.
export const STREAK_BONUS_LRN: Record<number, number> = {
	7: 5,
	30: 20,
	100: 100,
}

const STREAK_THRESHOLDS = Object.keys(STREAK_BONUS_LRN)
	.map(Number)
	.sort((a, b) => a - b)

export interface LearnerStreak {
	learner_address: string
	current_streak: number
	longest_streak: number
	last_active_date: string | null
	daily_goal: number
	updated_at: string
}

export interface StreakDay {
	date: string
	completed: boolean
}

export interface StreakSummary {
	current_streak: number
	longest_streak: number
	daily_goal: number
	todays_progress: number
	goal_met: boolean
	last_7_days: StreakDay[]
}

export interface RecordActivityResult {
	streak: LearnerStreak
	bonusThreshold: number | null
}

function todayUtc(): string {
	return new Date().toISOString().slice(0, 10)
}

function toDateOnly(value: unknown): string | null {
	if (!value) return null
	return String(value).slice(0, 10)
}

function daysBetween(laterIso: string, earlierIso: string): number {
	const msPerDay = 24 * 60 * 60 * 1000
	return Math.round((Date.parse(laterIso) - Date.parse(earlierIso)) / msPerDay)
}

async function getStreakRow(learnerAddress: string): Promise<{
	learner_address: string
	current_streak: number
	longest_streak: number
	last_active_date: string | null
	daily_goal: number
}> {
	const result = await pool.query(
		`SELECT learner_address, current_streak, longest_streak, last_active_date, daily_goal
		 FROM learner_streaks WHERE learner_address = $1`,
		[learnerAddress],
	)
	const row = result.rows[0]
	if (!row) {
		return {
			learner_address: learnerAddress,
			current_streak: 0,
			longest_streak: 0,
			last_active_date: null,
			daily_goal: 1,
		}
	}
	return {
		learner_address: row.learner_address,
		current_streak: Number(row.current_streak ?? 0),
		longest_streak: Number(row.longest_streak ?? 0),
		last_active_date: toDateOnly(row.last_active_date),
		daily_goal: Number(row.daily_goal ?? 1),
	}
}

async function mintStreakBonus(
	learnerAddress: string,
	threshold: number,
): Promise<void> {
	const bonusLrn = STREAK_BONUS_LRN[threshold]
	if (!bonusLrn) return

	try {
		const { txHash } = await learnTokenService.mintLearnTokenBonus(
			learnerAddress,
			BigInt(bonusLrn) * LRN_ATOMIC_UNIT,
		)
		log.info(
			{ learnerAddress, threshold, bonusLrn, txHash },
			"Streak bonus minted",
		)
	} catch (err) {
		log.error(
			{ err, learnerAddress, threshold },
			"Streak bonus mint failed (non-blocking)",
		)
	}
}

/**
 * Records today's milestone activity for a learner and recomputes their
 * streak. Called once per approved milestone report. Increments the streak
 * if the learner was also active yesterday, resets to 1 on a missed day, and
 * leaves the streak unchanged if this is a second activity on the same day.
 */
export async function recordMilestoneActivity(
	learnerAddress: string,
): Promise<RecordActivityResult> {
	const today = todayUtc()

	await pool.query(
		`INSERT INTO streak_activity (learner_address, activity_date, milestones_done)
		 VALUES ($1, $2, 1)
		 ON CONFLICT (learner_address, activity_date)
		 DO UPDATE SET milestones_done = streak_activity.milestones_done + 1`,
		[learnerAddress, today],
	)

	const existing = await getStreakRow(learnerAddress)
	const previousLongest = existing.longest_streak

	let currentStreak: number
	if (existing.last_active_date === today) {
		// Already logged activity today — streak length doesn't change again.
		currentStreak = existing.current_streak || 1
	} else if (
		existing.last_active_date &&
		daysBetween(today, existing.last_active_date) === 1
	) {
		currentStreak = existing.current_streak + 1
	} else {
		currentStreak = 1
	}

	const longestStreak = Math.max(previousLongest, currentStreak)

	const result = await pool.query(
		`INSERT INTO learner_streaks (learner_address, current_streak, longest_streak, last_active_date, daily_goal, updated_at)
		 VALUES ($1, $2, $3, $4, $5, NOW())
		 ON CONFLICT (learner_address)
		 DO UPDATE SET
			current_streak = $2,
			longest_streak = $3,
			last_active_date = $4,
			updated_at = NOW()
		 RETURNING learner_address, current_streak, longest_streak, last_active_date, daily_goal, updated_at`,
		[learnerAddress, currentStreak, longestStreak, today, existing.daily_goal],
	)
	const row = result.rows[0]
	const streak: LearnerStreak = {
		learner_address: row.learner_address,
		current_streak: Number(row.current_streak),
		longest_streak: Number(row.longest_streak),
		last_active_date: toDateOnly(row.last_active_date),
		daily_goal: Number(row.daily_goal),
		updated_at: String(row.updated_at),
	}

	// longest_streak only ever grows by 1 per activity, so at most one
	// threshold can be newly crossed here — guaranteeing exactly one bonus
	// per threshold, and no double-fire when a learner logs a second
	// milestone the same day (current/longest are unchanged in that case).
	let bonusThreshold: number | null = null
	for (const threshold of STREAK_THRESHOLDS) {
		if (previousLongest < threshold && longestStreak >= threshold) {
			bonusThreshold = threshold
			break
		}
	}

	if (bonusThreshold !== null) {
		void mintStreakBonus(learnerAddress, bonusThreshold)
	}

	return { streak, bonusThreshold }
}

async function getRecentActivity(
	learnerAddress: string,
	days: number,
): Promise<StreakDay[]> {
	const result = await pool.query(
		`SELECT activity_date, milestones_done FROM streak_activity
		 WHERE learner_address = $1 AND activity_date >= (CURRENT_DATE - $2::int)
		 ORDER BY activity_date ASC`,
		[learnerAddress, days - 1],
	)
	const doneByDate = new Map<string, boolean>()
	for (const row of result.rows) {
		const date = toDateOnly(row.activity_date)
		if (date) doneByDate.set(date, Number(row.milestones_done) > 0)
	}

	const out: StreakDay[] = []
	const now = new Date()
	for (let i = days - 1; i >= 0; i--) {
		const d = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
		)
		d.setUTCDate(d.getUTCDate() - i)
		const key = d.toISOString().slice(0, 10)
		out.push({ date: key, completed: doneByDate.get(key) ?? false })
	}
	return out
}

export async function getStreakSummary(
	learnerAddress: string,
): Promise<StreakSummary> {
	const row = await getStreakRow(learnerAddress)
	const today = todayUtc()

	const activityResult = await pool.query(
		`SELECT milestones_done FROM streak_activity
		 WHERE learner_address = $1 AND activity_date = $2`,
		[learnerAddress, today],
	)
	const todaysProgress = Number(activityResult.rows[0]?.milestones_done ?? 0)
	const last7Days = await getRecentActivity(learnerAddress, 7)

	return {
		current_streak: row.current_streak,
		longest_streak: row.longest_streak,
		daily_goal: row.daily_goal,
		todays_progress: todaysProgress,
		goal_met: todaysProgress >= row.daily_goal,
		last_7_days: last7Days,
	}
}

export async function setDailyGoal(
	learnerAddress: string,
	dailyGoal: number,
): Promise<LearnerStreak> {
	const result = await pool.query(
		`INSERT INTO learner_streaks (learner_address, daily_goal, updated_at)
		 VALUES ($1, $2, NOW())
		 ON CONFLICT (learner_address)
		 DO UPDATE SET daily_goal = $2, updated_at = NOW()
		 RETURNING learner_address, current_streak, longest_streak, last_active_date, daily_goal, updated_at`,
		[learnerAddress, dailyGoal],
	)
	const row = result.rows[0]
	return {
		learner_address: row.learner_address,
		current_streak: Number(row.current_streak),
		longest_streak: Number(row.longest_streak),
		last_active_date: toDateOnly(row.last_active_date),
		daily_goal: Number(row.daily_goal),
		updated_at: String(row.updated_at),
	}
}

export const streakService = {
	recordMilestoneActivity,
	getStreakSummary,
	setDailyGoal,
}
