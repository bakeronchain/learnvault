interface Props {
	deadlineLedger: number
	currentLedger: number
}

type CountdownTone = "green" | "orange" | "red"

interface CountdownState {
	label: string
	tone: CountdownTone
}

const LEDGER_SECONDS = 6
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
		return { label: "Voting closed", tone: "red" }
	}

	if (secondsRemaining < DAY_SECONDS) {
		const hours = Math.floor(secondsRemaining / HOUR_SECONDS)
		const minutes = Math.floor(
			(secondsRemaining % HOUR_SECONDS) / MINUTE_SECONDS,
		)
		return { label: `${hours} hours ${minutes} min remaining`, tone: "orange" }
	}

	const days = Math.floor(secondsRemaining / DAY_SECONDS)
	const hours = Math.floor((secondsRemaining % DAY_SECONDS) / HOUR_SECONDS)
	return { label: `${days} days ${hours} hours remaining`, tone: "green" }
}

const toneClassMap: Record<CountdownTone, string> = {
	green: "text-green-400",
	orange: "text-orange-400",
	red: "text-red-400",
}

export default function ProposalCountdown({
	deadlineLedger,
	currentLedger,
}: Readonly<Props>) {
	const state = getProposalCountdownState(deadlineLedger, currentLedger)
	return <span className={toneClassMap[state.tone]}>{state.label}</span>
}
