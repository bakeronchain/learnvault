import { useCallback, useEffect, useState } from "react"
import { createAuthHeaders } from "../lib/api"

export interface StreakDay {
	date: string
	completed: boolean
}

export interface StreakState {
	current_streak: number
	longest_streak: number
	daily_goal: number
	todays_progress: number
	goal_met: boolean
	last_7_days: StreakDay[]
}

const DEFAULT_STATE: StreakState = {
	current_streak: 0,
	longest_streak: 0,
	daily_goal: 1,
	todays_progress: 0,
	goal_met: false,
	last_7_days: [],
}

function authHeaders(): Headers {
	const headers = createAuthHeaders()
	headers.set("Content-Type", "application/json")
	return headers
}

// Background poll interval so the widget picks up a streak bump (and its
// celebration) soon after a milestone is approved elsewhere, without the
// learner needing to reload the dashboard.
const POLL_INTERVAL_MS = 60_000

export function useStreak(address?: string) {
	const [streak, setStreak] = useState<StreakState>(DEFAULT_STATE)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [isSaving, setIsSaving] = useState(false)

	const fetchStreak = useCallback(
		async (opts: { silent?: boolean } = {}) => {
			if (!address) return
			if (!opts.silent) setIsLoading(true)
			setError(null)
			try {
				const res = await fetch(`/api/streaks/${encodeURIComponent(address)}`, {
					headers: authHeaders(),
				})
				if (!res.ok) throw new Error("Failed to fetch streak")
				const data = await res.json()
				if (data?.data) {
					setStreak({ ...DEFAULT_STATE, ...data.data })
				}
			} catch (err) {
				console.error("Failed to fetch streak:", err)
				setError("Unable to load streak right now.")
			} finally {
				if (!opts.silent) setIsLoading(false)
			}
		},
		[address],
	)

	useEffect(() => {
		void fetchStreak()
	}, [fetchStreak])

	useEffect(() => {
		if (!address) return
		const interval = window.setInterval(() => {
			void fetchStreak({ silent: true })
		}, POLL_INTERVAL_MS)
		return () => window.clearInterval(interval)
	}, [address, fetchStreak])

	const updateDailyGoal = useCallback(
		async (dailyGoal: number) => {
			if (!address) return
			setIsSaving(true)
			setError(null)
			try {
				const res = await fetch(
					`/api/streaks/${encodeURIComponent(address)}/goal`,
					{
						method: "PUT",
						headers: authHeaders(),
						body: JSON.stringify({ dailyGoal }),
					},
				)
				if (!res.ok) throw new Error("Failed to update daily goal")
				await fetchStreak()
			} catch (err) {
				console.error("Failed to update daily goal:", err)
				setError("Unable to update daily goal right now.")
			} finally {
				setIsSaving(false)
			}
		},
		[address, fetchStreak],
	)

	return {
		streak,
		isLoading,
		error,
		isSaving,
		updateDailyGoal,
		refresh: fetchStreak,
	}
}
