import React, { useMemo, useState } from "react"

import { useToast } from "../components/Toast/ToastProvider"
import { useWallet } from "../hooks/useWallet"
import {
	estimateMatchWithContribution,
	useQfRounds,
	useQfStandings,
	type QfRound,
	type QfStanding,
} from "../hooks/useQfRounds"
import { apiFetchJson } from "../lib/api"

const formatUsdc = (value: number): string =>
	value.toLocaleString(undefined, {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	})

const statusBadge = (status: string): string => {
	switch (status) {
		case "active":
			return "bg-brand-cyan/20 text-brand-cyan border-brand-cyan/30"
		case "upcoming":
			return "bg-brand-blue/20 text-brand-blue border-brand-blue/30"
		case "closed":
			return "bg-amber-500/20 text-amber-300 border-amber-500/30"
		case "finalized":
			return "bg-white/10 text-white/60 border-white/20"
		default:
			return "bg-white/10 text-white/60 border-white/20"
	}
}

const QuadraticFunding: React.FC = () => {
	const { rounds, isLoading, error } = useQfRounds()
	const [selectedId, setSelectedId] = useState<number | null>(null)

	const activeRounds = useMemo(
		() =>
			[...rounds].sort((a, b) => {
				const rank = (r: QfRound) =>
					(r.effective_status ?? r.status) === "active" ? 0 : 1
				return rank(a) - rank(b)
			}),
		[rounds],
	)

	const currentId = selectedId ?? activeRounds[0]?.id ?? null
	const currentRound = rounds.find((r) => r.id === currentId) ?? null

	return (
		<div className="p-8 md:p-12 max-w-6xl mx-auto text-white">
			<header className="mb-10">
				<h1 className="text-4xl sm:text-5xl font-black mb-3 tracking-tighter text-gradient">
					Quadratic Funding
				</h1>
				<p className="text-white/50 max-w-2xl">
					Community-directed matching for scholarships. A DAO matching pool is
					split across proposals using the quadratic-funding formula, so the
					number of unique donors matters more than the size of any single
					donation.
				</p>
			</header>

			{isLoading && (
				<div className="glass-card p-8 rounded-3xl border border-white/5 animate-pulse text-white/40">
					Loading rounds…
				</div>
			)}

			{error && !isLoading && (
				<div className="glass-card p-8 rounded-3xl border border-red-500/20 text-red-300">
					{error}
				</div>
			)}

			{!isLoading && !error && rounds.length === 0 && (
				<div className="glass-card p-12 rounded-3xl border border-white/5 text-center text-white/50">
					No funding rounds yet. Check back soon.
				</div>
			)}

			{rounds.length > 0 && (
				<div className="flex flex-wrap gap-3 mb-8">
					{activeRounds.map((round) => {
						const status = round.effective_status ?? round.status
						const isSelected = round.id === currentId
						return (
							<button
								key={round.id}
								type="button"
								onClick={() => setSelectedId(round.id)}
								className={`px-5 py-3 rounded-2xl border text-left transition-colors ${
									isSelected
										? "border-brand-cyan/40 bg-brand-cyan/10"
										: "border-white/10 hover:border-white/20"
								}`}
							>
								<div className="font-bold">{round.name}</div>
								<div className="flex items-center gap-2 mt-1">
									<span
										className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${statusBadge(status)}`}
									>
										{status}
									</span>
									<span className="text-xs text-white/40">
										Pool {formatUsdc(round.matching_pool)} USDC
									</span>
								</div>
							</button>
						)
					})}
				</div>
			)}

			{currentRound && <RoundDetail round={currentRound} />}
		</div>
	)
}

interface RoundDetailProps {
	round: QfRound
}

const RoundDetail: React.FC<RoundDetailProps> = ({ round }) => {
	const { data, isLoading, error, reload } = useQfStandings(round.id)
	const standings = data?.standings ?? []
	const status = data?.status ?? round.effective_status ?? round.status

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
				<StatCard label="Matching pool" value={`${formatUsdc(round.matching_pool)} USDC`} />
				<StatCard
					label="Proposals"
					value={String(standings.length)}
				/>
				<StatCard
					label="Total raised"
					value={`${formatUsdc(
						standings.reduce((s, p) => s + p.total_contributions, 0),
					)} USDC`}
				/>
				<StatCard
					label="Unique donors"
					value={String(
						standings.reduce((s, p) => s + p.unique_contributors, 0),
					)}
				/>
			</div>

			{isLoading && (
				<div className="glass-card p-6 rounded-3xl border border-white/5 text-white/40 animate-pulse">
					Loading standings…
				</div>
			)}

			{error && (
				<div className="glass-card p-6 rounded-3xl border border-red-500/20 text-red-300">
					{error}
				</div>
			)}

			{!isLoading && !error && (
				<Leaderboard
					roundId={round.id}
					matchingPool={round.matching_pool}
					standings={standings}
					canContribute={status === "active"}
					onContributed={reload}
				/>
			)}
		</div>
	)
}

const StatCard: React.FC<{ label: string; value: string }> = ({
	label,
	value,
}) => (
	<div className="glass-card p-5 rounded-2xl border border-white/5">
		<div className="text-xs uppercase tracking-wide text-white/40 mb-1">
			{label}
		</div>
		<div className="text-xl font-black">{value}</div>
	</div>
)

interface LeaderboardProps {
	roundId: number
	matchingPool: number
	standings: QfStanding[]
	canContribute: boolean
	onContributed: () => void
}

const Leaderboard: React.FC<LeaderboardProps> = ({
	roundId,
	matchingPool,
	standings,
	canContribute,
	onContributed,
}) => {
	if (standings.length === 0) {
		return (
			<div className="glass-card p-10 rounded-3xl border border-white/5 text-center text-white/50">
				No contributions yet. Be the first to fund a proposal.
			</div>
		)
	}

	return (
		<div className="space-y-4">
			{standings.map((standing, index) => (
				<ProposalRow
					key={standing.proposal_id}
					rank={index + 1}
					roundId={roundId}
					matchingPool={matchingPool}
					standing={standing}
					standings={standings}
					canContribute={canContribute}
					onContributed={onContributed}
				/>
			))}
		</div>
	)
}

interface ProposalRowProps {
	rank: number
	roundId: number
	matchingPool: number
	standing: QfStanding
	standings: QfStanding[]
	canContribute: boolean
	onContributed: () => void
}

const ProposalRow: React.FC<ProposalRowProps> = ({
	rank,
	roundId,
	matchingPool,
	standing,
	standings,
	canContribute,
	onContributed,
}) => {
	const { address } = useWallet()
	const { showSuccess, showError, showInfo } = useToast()
	const [amount, setAmount] = useState("")
	const [txHash, setTxHash] = useState("")
	const [submitting, setSubmitting] = useState(false)

	const parsedAmount = Number(amount)
	const projectedMatch = useMemo(() => {
		if (!(parsedAmount > 0)) return standing.estimated_match
		return estimateMatchWithContribution(
			standings,
			matchingPool,
			standing.proposal_id,
			parsedAmount,
		)
	}, [parsedAmount, standings, matchingPool, standing])

	const matchDelta = projectedMatch - standing.estimated_match

	const handleContribute = async () => {
		if (!address) {
			showError("Connect your wallet to contribute.")
			return
		}
		if (!(parsedAmount > 0)) {
			showError("Enter a contribution amount greater than zero.")
			return
		}
		if (!txHash.trim()) {
			showInfo(
				"Submit your USDC transfer to the pool first, then paste the transaction hash here.",
			)
			return
		}

		setSubmitting(true)
		try {
			await apiFetchJson(`/api/qf/rounds/${roundId}/contribute`, {
				method: "POST",
				auth: true,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					proposal_id: standing.proposal_id,
					amount_usdc: parsedAmount,
					tx_hash: txHash.trim(),
				}),
			})
			showSuccess("Contribution recorded", txHash.trim())
			setAmount("")
			setTxHash("")
			onContributed()
		} catch (err) {
			showError(
				err instanceof Error ? err.message : "Failed to record contribution",
			)
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<div className="glass-card p-6 rounded-3xl border border-white/5">
			<div className="flex items-start justify-between gap-4 flex-wrap">
				<div>
					<div className="flex items-center gap-3">
						<span className="text-2xl font-black text-white/30">#{rank}</span>
						<h3 className="text-lg font-black">
							Proposal #{standing.proposal_id}
						</h3>
					</div>
					<div className="flex flex-wrap gap-4 mt-2 text-sm text-white/50">
						<span>
							Raised{" "}
							<strong className="text-white">
								{formatUsdc(standing.total_contributions)} USDC
							</strong>
						</span>
						<span>
							<strong className="text-white">
								{standing.unique_contributors}
							</strong>{" "}
							unique donor{standing.unique_contributors === 1 ? "" : "s"}
						</span>
					</div>
				</div>
				<div className="text-right">
					<div className="text-xs uppercase tracking-wide text-white/40">
						Estimated match
					</div>
					<div className="text-2xl font-black text-brand-cyan">
						{formatUsdc(projectedMatch)} USDC
					</div>
					{parsedAmount > 0 && matchDelta > 0 && (
						<div className="text-xs text-brand-cyan/70">
							+{formatUsdc(matchDelta)} from your contribution
						</div>
					)}
				</div>
			</div>

			{canContribute && (
				<div className="mt-5 flex flex-col sm:flex-row gap-3">
					<input
						value={amount}
						inputMode="decimal"
						onChange={(e) => {
							const v = e.target.value
							if (v === "" || /^\d+(\.\d{0,7})?$/.test(v)) setAmount(v)
						}}
						placeholder="Amount (USDC)"
						className="flex-1 rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
					/>
					<input
						value={txHash}
						onChange={(e) => setTxHash(e.target.value)}
						placeholder="Transaction hash"
						className="flex-1 rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
					/>
					<button
						type="button"
						onClick={() => void handleContribute()}
						disabled={submitting}
						className="px-5 py-3 rounded-xl bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 hover:bg-brand-cyan/30 transition-colors disabled:opacity-50"
					>
						{submitting ? "Recording…" : "Contribute"}
					</button>
				</div>
			)}
		</div>
	)
}

export default QuadraticFunding
