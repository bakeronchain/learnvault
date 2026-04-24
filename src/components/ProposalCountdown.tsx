import { useEffect, useState } from "react"
import { LEDGERS_PER_DAY } from "../constants/network"

interface Props {
	deadlineLedger: number
	currentLedger: number
	network?: "testnet" | "mainnet" | "futurenet"
}

type CountdownTone = "green" | "orange" | "red"

interface CountdownState {
	label: string
	tone: CountdownTone
	secondsRemaining: number
}

const LEDGER_SECONDS = (24 * 60 * 60) / LEDGERS_PER_DAY
const DAY_SECONDS = 24 * 60 * 60
const HOUR_SECONDS = 60 * 60
const MINUTE_SECONDS = 60

export function getProposalCountdownState(
	deadlineLedger: number,
	currentLedger: number,
): CountdownState {
	const ledgersRemaining = deadlineLedger - currentLedger
	const secondsRemaining = ledgersRemaining * LEDGER_SECONDS

	if (secondsRemaining <= 0) {
		return { label: "Voting closed", tone: "red", secondsRemaining: 0 }
	}

	if (secondsRemaining < DAY_SECONDS) {
		const hours = Math.floor(secondsRemaining / HOUR_SECONDS)
		const minutes = Math.floor(
			(secondsRemaining % HOUR_SECONDS) / MINUTE_SECONDS,
		)
		return {
			label: `${hours}h ${minutes}m remaining`,
			tone: "orange",
			secondsRemaining,
		}
	}

	const days = Math.floor(secondsRemaining / DAY_SECONDS)
	const hours = Math.floor((secondsRemaining % DAY_SECONDS) / HOUR_SECONDS)
	return {
		label: `${days}d ${hours}h remaining`,
		tone: "green",
		secondsRemaining,
	}
}

const toneClassMap: Record<CountdownTone, string> = {
	green: "text-green-400",
	orange: "text-orange-400",
	red: "text-red-400",
}

/**
 * Live countdown timer for DAO proposal voting deadlines.
 * Updates every second and provides accessibility announcements.
 */
export default function ProposalCountdown({
	deadlineLedger,
	currentLedger,
}: Readonly<Props>) {
	const [state, setState] = useState<CountdownState>(() =>
		getProposalCountdownState(deadlineLedger, currentLedger),
	)
	const [announcement, setAnnouncement] = useState<string>("")

	useEffect(() => {
		// Update immediately on mount
		setState(getProposalCountdownState(deadlineLedger, currentLedger))

		// Set up interval for live updates
		const intervalId = setInterval(() => {
			const newState = getProposalCountdownState(
				deadlineLedger,
				currentLedger + 1,
			)
			setState(newState)

			// Announce time changes for screen readers (every minute)
			if (
				newState.secondsRemaining % 60 === 0 &&
				newState.secondsRemaining > 0
			) {
				setAnnouncement(`Voting time remaining: ${newState.label}`)
			}
		}, LEDGER_SECONDS * 1000) // Update every 6 seconds (1 ledger time)

		return () => clearInterval(intervalId)
	}, [deadlineLedger, currentLedger])

	// Calculate progress for visual indicator
	const totalLedgers =
		deadlineLedger - currentLedger + state.secondsRemaining / 6
	const progress = Math.min(
		100,
		Math.max(0, (state.secondsRemaining / (totalLedgers * 6)) * 100),
	)

	return (
		<span className="flex items-center gap-2">
			<span
				className={toneClassMap[state.tone]}
				role="timer"
				aria-live="polite"
				aria-label={`Voting time remaining: ${state.label}`}
			>
				{state.label}
			</span>
			{/* Visual progress indicator */}
			{state.secondsRemaining > 0 && (
				<div className="w-12 h-1 bg-gray-700 rounded-full overflow-hidden">
					<div
						className={`h-full transition-all duration-1000 ${
							state.tone === "green"
								? "bg-green-400"
								: state.tone === "orange"
									? "bg-orange-400"
									: "bg-red-400"
						}`}
						style={{ width: `${progress}%` }}
					/>
				</div>
			)}
			{/* Screen reader announcement (visually hidden) */}
			<span className="sr-only" role="status" aria-live="assertive">
				{announcement}
			</span>
		</span>
	)
}
