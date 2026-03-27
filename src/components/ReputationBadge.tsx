import { useLearnToken } from "../hooks/useLearnToken"
import { useWallet } from "../hooks/useWallet"
import {
	getReputationRankFromLrn,
	lrnBalanceToNumber,
	type ReputationTier,
} from "../util/reputationRank"
import { formatLrnBalance } from "../util/scholarshipApplications"

const TIER_STYLES: Record<
	ReputationTier,
	{ border: string; text: string; dot: string }
> = {
	newcomer: {
		border: "border-white/15",
		text: "text-white/50",
		dot: "bg-white/30",
	},
	committed: {
		border: "border-emerald-500/35",
		text: "text-emerald-300/90",
		dot: "bg-emerald-400",
	},
	rising_star: {
		border: "border-brand-cyan/40",
		text: "text-brand-cyan",
		dot: "bg-brand-cyan",
	},
	top_scholar: {
		border: "border-sky-400/40",
		text: "text-sky-300",
		dot: "bg-sky-400",
	},
	elite: {
		border: "border-brand-purple/45",
		text: "text-brand-purple",
		dot: "bg-brand-purple",
	},
	legend: {
		border: "border-amber-400/50",
		text: "text-amber-300",
		dot: "bg-amber-400",
	},
}

const SIZE_CLASSES = {
	sm: {
		root: "px-3 py-1.5 gap-1.5 text-[10px]",
		rank: "tracking-widest",
		balance: "text-[9px] opacity-80",
	},
	md: {
		root: "px-5 py-2 gap-2 text-xs",
		rank: "tracking-widest",
		balance: "text-[10px] opacity-85",
	},
} as const

export type ReputationBadgeSize = keyof typeof SIZE_CLASSES

export interface ReputationBadgeProps {
	/** Override wallet address (defaults to connected account) */
	address?: string
	className?: string
	size?: ReputationBadgeSize
	/** Include formatted LRN amount next to the rank label */
	showBalance?: boolean
}

/**
 * Compact rank badge derived from the learner's on-chain LearnToken (LRN) balance.
 */
export function ReputationBadge({
	address: addressProp,
	className = "",
	size = "sm",
	showBalance = true,
}: ReputationBadgeProps) {
	const { address: connected } = useWallet()
	const address = addressProp ?? connected

	const { balance, isLoading } = useLearnToken(address)

	if (!address) return null

	const styles = SIZE_CLASSES[size]

	if (isLoading || balance === undefined) {
		return (
			<div
				className={`inline-flex items-center rounded-full border border-white/10 bg-white/5 ${styles.root} animate-pulse ${className}`.trim()}
				aria-busy="true"
				aria-label="Loading reputation"
			>
				<span className="h-2 w-2 rounded-full bg-white/20" />
				<span className="h-3 w-16 rounded bg-white/10" />
				{showBalance ? <span className="h-3 w-10 rounded bg-white/10" /> : null}
			</div>
		)
	}

	const rank = getReputationRankFromLrn(balance)
	const tierStyle = TIER_STYLES[rank.tier]
	const numeric = formatLrnBalance(lrnBalanceToNumber(balance))

	return (
		<div
			className={`glass inline-flex items-center rounded-full border ${tierStyle.border} ${styles.root} font-black uppercase ${className}`.trim()}
			role="status"
			aria-label={`Reputation rank ${rank.label}, ${numeric} LRN`}
		>
			<span
				className={`h-2 w-2 shrink-0 rounded-full ${tierStyle.dot} animate-pulse`}
				aria-hidden
			/>
			<span className={`${tierStyle.text} ${styles.rank}`}>{rank.label}</span>
			{showBalance ? (
				<span className={`${tierStyle.text} ${styles.balance} normal-case`}>
					{numeric} LRN
				</span>
			) : null}
		</div>
	)
}

export default ReputationBadge
