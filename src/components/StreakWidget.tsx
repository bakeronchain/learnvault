import { Flame } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useStreak } from "../hooks/useStreak"
import { useWallet } from "../hooks/useWallet"
import MilestoneCelebration from "./MilestoneCelebration"

const DAILY_GOAL_OPTIONS = [1, 2, 3, 5]
const STREAK_BONUS_LRN: Record<number, number> = { 7: 5, 30: 20, 100: 100 }
const STREAK_THRESHOLDS = Object.keys(STREAK_BONUS_LRN)
	.map(Number)
	.sort((a, b) => a - b)

const dayLabel = (isoDate: string) =>
	new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(undefined, {
		weekday: "short",
	})

export default function StreakWidget() {
	const { address } = useWallet()
	const { streak, isLoading, error, isSaving, updateDailyGoal } =
		useStreak(address)
	const [isEditingGoal, setIsEditingGoal] = useState(false)
	const [celebrationThreshold, setCelebrationThreshold] = useState<
		number | null
	>(null)
	const previousStreakRef = useRef<number | null>(null)

	useEffect(() => {
		if (isLoading) return
		const previous = previousStreakRef.current
		if (previous !== null && streak.current_streak > previous) {
			const hit = STREAK_THRESHOLDS.find(
				(threshold) =>
					previous < threshold && streak.current_streak >= threshold,
			)
			if (hit !== undefined) setCelebrationThreshold(hit)
		}
		previousStreakRef.current = streak.current_streak
	}, [streak.current_streak, isLoading])

	if (!address) return null

	if (isLoading) {
		return (
			<div
				className="glass-card rounded-[2rem] border border-white/10 p-6 h-48 animate-pulse"
				aria-label="Loading streak"
			/>
		)
	}

	if (error) {
		return (
			<section
				className="glass-card rounded-[2rem] border border-white/10 p-6"
				aria-label="Learning streak"
			>
				<p className="text-sm text-white/50">{error}</p>
			</section>
		)
	}

	const progressPct =
		streak.daily_goal > 0
			? Math.min(
					100,
					Math.round((streak.todays_progress / streak.daily_goal) * 100),
				)
			: 0

	const bonusLrn = celebrationThreshold
		? STREAK_BONUS_LRN[celebrationThreshold]
		: 0

	return (
		<section
			className="glass-card space-y-5 rounded-[2rem] border border-white/10 p-6"
			aria-label="Learning streak"
		>
			<div className="flex items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<Flame
						className={
							streak.current_streak > 0 ? "text-orange-400" : "text-white/30"
						}
						aria-hidden="true"
					/>
					<div>
						<p className="text-2xl font-black text-white">
							{streak.current_streak}-day streak
						</p>
						<p className="text-xs text-white/50">
							Longest: {streak.longest_streak} days
						</p>
					</div>
				</div>
				<div
					className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2"
					style={{
						borderColor: streak.goal_met
							? "#22c55e"
							: "rgba(255, 255, 255, 0.2)",
					}}
					role="progressbar"
					aria-valuenow={progressPct}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-label="Today's goal progress"
				>
					<span className="text-xs font-bold text-white">
						{streak.todays_progress}/{streak.daily_goal}
					</span>
				</div>
			</div>

			<div className="flex items-center gap-2" aria-label="Last 7 days">
				{streak.last_7_days.map((day) => (
					<span
						key={day.date}
						title={`${dayLabel(day.date)}: ${day.completed ? "active" : "no activity"}`}
						className={`h-3 w-3 rounded-full ${
							day.completed ? "bg-brand-cyan" : "bg-white/10"
						}`}
					/>
				))}
			</div>

			{streak.goal_met && (
				<p className="text-xs font-semibold text-green-400">
					Today&apos;s goal met! 🎉
				</p>
			)}

			<div className="flex items-center justify-between text-xs text-white/50">
				<span>
					Daily goal: {streak.daily_goal} milestone
					{streak.daily_goal === 1 ? "" : "s"}
				</span>
				<button
					type="button"
					className="font-semibold text-brand-cyan hover:text-brand-cyan/80"
					onClick={() => setIsEditingGoal((prev) => !prev)}
				>
					{isEditingGoal ? "Close" : "Edit goal"}
				</button>
			</div>

			{isEditingGoal && (
				<div
					className="flex flex-wrap gap-2"
					role="group"
					aria-label="Set daily goal"
				>
					{DAILY_GOAL_OPTIONS.map((goal) => (
						<button
							key={goal}
							type="button"
							disabled={isSaving}
							onClick={() => void updateDailyGoal(goal)}
							className={`min-h-8 rounded-full px-3 py-1 text-xs font-semibold transition ${
								streak.daily_goal === goal
									? "bg-brand-cyan text-black"
									: "bg-white/10 text-white/70 hover:bg-white/20"
							}`}
						>
							{goal}/day
						</button>
					))}
				</div>
			)}

			{celebrationThreshold !== null && (
				<MilestoneCelebration
					isOpen
					onClose={() => setCelebrationThreshold(null)}
					rewardAmount={bonusLrn}
					newBalance={bonusLrn}
					lessonName={`your ${celebrationThreshold}-day streak`}
					isFinalMilestone={celebrationThreshold === 100}
				/>
			)}
		</section>
	)
}
