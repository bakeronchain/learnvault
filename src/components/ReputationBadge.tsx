import { getRank } from "../constants/reputation"
import { useLearnToken } from "../hooks/useLearnToken"
import { useWallet } from "../hooks/useWallet"
import { formatLrnBalance } from "../util/scholarshipApplications"

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

	const numericLrn =
		balance <= BigInt(Number.MAX_SAFE_INTEGER)
			? Number(balance)
			: Number.MAX_SAFE_INTEGER
	const rank = getRank(numericLrn)
	const numeric = formatLrnBalance(numericLrn)

	return (
		<div
			className={`glass inline-flex items-center rounded-full border ${styles.root} font-black uppercase ${className}`.trim()}
			role="status"
			aria-label={`Reputation rank ${rank.rank}, ${numeric} LRN`}
			style={{ borderColor: rank.color }}
		>
			<span
				className="h-2 w-2 shrink-0 rounded-full animate-pulse"
				aria-hidden
				style={{ backgroundColor: rank.color }}
			/>
			<span className={styles.rank} style={{ color: rank.color }}>
				{rank.rank}
			</span>
			{showBalance ? (
				<span
					className={`${styles.balance} normal-case`}
					style={{ color: rank.color }}
				>
					{numeric} LRN
				</span>
			) : null}
		</div>
	)
}

export default ReputationBadge
