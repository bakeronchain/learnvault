import React from "react"
import { Link } from "react-router-dom"
import { useProposals } from "../hooks/useProposals"
import { useWallet } from "../hooks/useWallet"
import { hasProposalDraft } from "../util/proposalDraft"
import { useState, useEffect } from "react"

export default function Dao() {
	const { address } = useWallet()
	const { proposals, votingPower, isLoading } = useProposals()
	const [hasDraft, setHasDraft] = useState(false)

	useEffect(() => {
		setHasDraft(hasProposalDraft())
	}, [])

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
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
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
					className={`relative px-10 py-4 glass text-white rounded-2xl font-black text-sm uppercase tracking-widest border border-white/10 transition-all ${
						address
							? "hover:bg-white/10 hover:scale-105 active:scale-95"
							: "opacity-40 pointer-events-none"
					}`}
					data-testid="create-proposal"
				>
					Create Proposal
					{hasDraft && (
						<span className="absolute -top-2 -right-2 w-4 h-4 bg-brand-amber rounded-full border-2 border-background animate-pulse" />
					)}
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
