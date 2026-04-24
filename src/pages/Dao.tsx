import React, { useState } from "react"
import { Link } from "react-router-dom"
import { useDelegation } from "../hooks/useDelegation"
import { useProposals } from "../hooks/useProposals"
import { useWallet } from "../hooks/useWallet"

const GOV_DECIMALS = 7
const GOV_DIVISOR = 10 ** GOV_DECIMALS

function formatGov(raw: string): string {
	const n = Number(raw) / GOV_DIVISOR
	return n.toLocaleString("en-US", { maximumFractionDigits: 2 })
}

function shortenAddress(addr: string): string {
	if (addr.length <= 12) return addr
	return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function Dao() {
	const { address } = useWallet()
	const { proposals, votingPower, isLoading } = useProposals()
	const {
		delegatee,
		isDelegating,
		ownBalance,
		delegatedToMe,
		votingPower: onChainVotingPower,
		isLoading: isDelegationLoading,
		isUpdating,
		delegateTo,
		undelegate,
	} = useDelegation()

	const [delegateeInput, setDelegateeInput] = useState("")
	const [inputError, setInputError] = useState<string | null>(null)

	const handleDelegate = async () => {
		setInputError(null)
		const trimmed = delegateeInput.trim()
		if (!trimmed) {
			setInputError("Enter the Stellar address of your delegatee.")
			return
		}
		try {
			await delegateTo(trimmed)
			setDelegateeInput("")
		} catch {
			// errors handled in hook via toast
		}
	}

	const handleUndelegate = async () => {
		try {
			await undelegate()
		} catch {
			// errors handled in hook via toast
		}
	}

	const ownFmt = formatGov(ownBalance)
	const delegatedFmt = formatGov(delegatedToMe)
	const effectiveFmt = formatGov(onChainVotingPower)

	return (
		<div className="p-8 md:p-12 max-w-5xl mx-auto text-white animate-in fade-in duration-700">
			<header className="text-center mb-16">
				<h1 className="text-6xl font-black mb-4 tracking-tighter text-gradient">
					DAO Governance
				</h1>
				<p className="text-white/40 text-lg font-medium max-w-2xl mx-auto">
					Browse live proposals, vote with your governance tokens, and shape the
					future of LearnVault.
				</p>
			</header>

			{/* Stats row */}
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
				<div className="glass-card p-8 rounded-[2.5rem] border border-white/5">
					<p className="text-[10px] uppercase font-black text-white/30 tracking-[2px] mb-2">
						Your Voting Power
					</p>
					<p
						className="text-3xl font-black text-brand-cyan"
						data-testid="gov-token-balance"
					>
						{votingPower.toString()}
						<span className="text-xs ml-2 text-white/20 uppercase">GOV</span>
					</p>
					{!address && (
						<p className="text-xs text-white/30 mt-2">
							Connect wallet to create proposals and vote.
						</p>
					)}
				</div>

				<div className="glass-card p-8 rounded-[2.5rem] border border-white/5">
					<p className="text-[10px] uppercase font-black text-white/30 tracking-[2px] mb-2">
						Active Proposals
					</p>
					<p className="text-3xl font-black text-brand-purple">
						{isLoading ? "—" : proposals.length}
					</p>
				</div>
			</div>

			{/* Delegation panel */}
			{address && (
				<div className="glass-card p-8 rounded-[2.5rem] border border-white/5 mb-12">
					<div className="flex items-center gap-3 mb-6">
						<span className="text-xl" aria-hidden="true">
							🗳️
						</span>
						<h2 className="text-lg font-black tracking-tight">
							Vote Delegation
						</h2>
						{isDelegating && (
							<span className="ml-auto text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-brand-purple/20 text-brand-purple border border-brand-purple/20">
								Delegating
							</span>
						)}
					</div>

					{isDelegationLoading ? (
						<div className="space-y-2">
							{[1, 2, 3].map((i) => (
								<div
									key={i}
									className="h-5 rounded-lg bg-white/5 animate-pulse"
								/>
							))}
						</div>
					) : (
						<>
							{/* Power breakdown */}
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
								<div className="rounded-2xl border border-white/5 bg-white/3 p-4">
									<p className="text-[10px] uppercase font-black text-white/30 tracking-widest mb-1">
										Own Balance
									</p>
									<p className="text-xl font-black text-white">
										{ownFmt}
										<span className="text-xs ml-1 text-white/20">GOV</span>
									</p>
								</div>
								<div className="rounded-2xl border border-white/5 bg-white/3 p-4">
									<p className="text-[10px] uppercase font-black text-white/30 tracking-widest mb-1">
										Delegated to Me
									</p>
									<p className="text-xl font-black text-brand-cyan">
										{delegatedFmt}
										<span className="text-xs ml-1 text-white/20">GOV</span>
									</p>
								</div>
								<div className="rounded-2xl border border-white/5 bg-white/3 p-4">
									<p className="text-[10px] uppercase font-black text-white/30 tracking-widest mb-1">
										Effective Power
									</p>
									<p className="text-xl font-black text-brand-emerald">
										{isDelegating ? (
											<span className="text-white/30">0</span>
										) : (
											effectiveFmt
										)}
										<span className="text-xs ml-1 text-white/20">GOV</span>
									</p>
								</div>
							</div>

							{/* Current delegation status */}
							{isDelegating && delegatee && (
								<div className="flex items-center justify-between rounded-2xl border border-brand-purple/20 bg-brand-purple/10 px-5 py-4 mb-5">
									<div>
										<p className="text-[10px] uppercase font-black text-white/30 tracking-widest mb-0.5">
											Currently delegating to
										</p>
										<p className="font-mono text-sm text-white/80">
											{shortenAddress(delegatee)}
										</p>
									</div>
									<button
										type="button"
										onClick={() => void handleUndelegate()}
										disabled={isUpdating}
										className="px-4 py-2 text-sm font-bold rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
									>
										{isUpdating ? "Removing…" : "Undelegate"}
									</button>
								</div>
							)}

							{/* Delegate form */}
							{!isDelegating && (
								<div>
									<p className="text-xs text-white/40 mb-3">
										Delegate your voting power to a trusted address. You can
										reclaim it at any time.
									</p>
									<div className="flex gap-3 flex-col sm:flex-row">
										<input
											type="text"
											value={delegateeInput}
											onChange={(e) => {
												setDelegateeInput(e.target.value)
												setInputError(null)
											}}
											placeholder="Stellar address (G…)"
											className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-mono text-white placeholder:text-white/20 focus:border-brand-cyan/40 focus:outline-none focus:ring-1 focus:ring-brand-cyan/40 transition-colors"
										/>
										<button
											type="button"
											onClick={() => void handleDelegate()}
											disabled={isUpdating || !delegateeInput.trim()}
											className="px-6 py-3 text-sm font-black rounded-xl bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan hover:bg-brand-cyan/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
										>
											{isUpdating ? "Delegating…" : "Delegate"}
										</button>
									</div>
									{inputError && (
										<p className="mt-2 text-xs text-red-400">{inputError}</p>
									)}
								</div>
							)}
						</>
					)}
				</div>
			)}

			{/* Action buttons */}
			<div className="flex flex-wrap gap-4 mb-16 justify-center">
				<Link
					to="/dao/proposals"
					className="iridescent-border px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
					data-testid="view-proposals"
				>
					View Proposals
				</Link>
				<Link
					to="/dao/propose"
					className={`px-10 py-4 glass text-white rounded-2xl font-black text-sm uppercase tracking-widest border border-white/10 transition-all ${
						address
							? "hover:bg-white/10 hover:scale-105 active:scale-95"
							: "opacity-40 pointer-events-none"
					}`}
					data-testid="create-proposal"
				>
					Create Proposal
				</Link>
			</div>

			{/* Recent proposals */}
			<section>
				<h2 className="text-2xl font-black mb-8 tracking-tight text-center">
					Recent Proposals
				</h2>
				{isLoading ? (
					<div className="space-y-4">
						{[1, 2, 3].map((i) => (
							<div
								key={i}
								className="h-24 rounded-[2rem] bg-white/5 animate-pulse"
							/>
						))}
					</div>
				) : proposals.length === 0 ? (
					<div className="glass-card p-12 rounded-[2.5rem] border border-white/5 text-center">
						<p className="text-white/40 font-medium">
							No proposals available yet.
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{proposals.slice(0, 3).map((proposal) => (
							<Link
								key={proposal.id}
								to={`/dao/proposals?proposal=${proposal.id}`}
								className="glass-card p-6 rounded-[2rem] border border-white/5 hover:border-brand-cyan/30 transition-all flex items-center justify-between group"
							>
								<div>
									<p
										className="font-black text-white group-hover:text-brand-cyan transition-colors"
										data-testid="proposal-title"
									>
										{proposal.title}
									</p>
									<p className="text-xs text-white/40 uppercase tracking-widest mt-1">
										{proposal.displayStatus}
									</p>
								</div>
								<div className="text-right text-xs">
									<p
										className="text-brand-cyan font-black"
										data-testid="vote-count"
									>
										{proposal.votesFor.toString()} Yes
									</p>
									<p className="text-brand-purple font-black">
										{proposal.votesAgainst.toString()} No
									</p>
								</div>
							</Link>
						))}
					</div>
				)}
			</section>
		</div>
	)
}
