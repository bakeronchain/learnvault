/**
 * pages/Dao.tsx
 *
 * Issue #44 — Add skeleton loading screens and empty state components
 * bakeronchain/learnvault
 *
 * Added: ProposalListSkeleton and NoProposalsEmptyState
 */

import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import CommentSection from "../components/CommentSection"
import {
	ProposalListSkeleton,
	NoProposalsEmptyState,
	NoTokensEmptyState,
} from "../components/SkeletonLoader"

interface Proposal {
	id: string
	title: string
	description: string
	author: string
	status: "Active" | "Passed" | "Rejected"
	votesFor: number
	votesAgainst: number
	endDate: string
}

const MOCK_PROPOSALS: Proposal[] = [
	{
		id: "1",
		title: "Incentivize Soroban Developers with LRN",
		description:
			"This proposal aims to allocate 1,000,000 LRN from the treasury to reward developers who contribute to core Soroban libraries and documentation. \n\n## Goals\n- Increase ecosystem activity\n- Improve developer onboarding\n- Reward high-quality technical content",
		author: "GA7B...4Y2K",
		status: "Active",
		votesFor: 450000,
		votesAgainst: 12000,
		endDate: "2024-04-15",
	},
	{
		id: "2",
		title: "Upgrade Protocol to v22",
		description:
			"Proposed upgrade to Soroban Protocol 22 to enable advanced storage optimizations and improved contract performance. \n\n### Impact\n- Lower gas fees\n- Faster execution\n- New SDK features",
		author: "GBSU...9R3T",
		status: "Active",
		votesFor: 890000,
		votesAgainst: 500,
		endDate: "2024-04-20",
	},
]

const Dao: React.FC = () => {
	const { t } = useTranslation()
	const [isLoading, setIsLoading] = useState(true)
	const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null)

	// Issue #44 — Simulate async data fetch for skeleton demo
	useEffect(() => {
		const timer = setTimeout(() => setIsLoading(false), 2000)
		return () => clearTimeout(timer)
	}, [])

	if (isLoading) {
		return (
			<div className="p-12 max-w-5xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
				<header className="mb-16 text-center">
					<h1 className="text-6xl font-black mb-4 tracking-tighter text-gradient">
						{t("pages.dao.title")}
					</h1>
					<p className="text-white/40 text-lg font-medium">
						{t("pages.dao.desc")}
					</p>
				</header>
				{/* Issue #44 — Proposal list skeleton */}
				<ProposalListSkeleton />
			</div>
		)
	}

	if (selectedProposal) {
		return (
			<div className="p-12 max-w-5xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
				<button
					onClick={() => setSelectedProposal(null)}
					className="mb-12 flex items-center gap-2 text-white/40 hover:text-brand-cyan transition-colors font-black uppercase tracking-widest text-xs"
				>
					← Back to Proposals
				</button>

				<header className="mb-16">
					<div className="flex justify-between items-start mb-6">
						<div>
							<h1 className="text-5xl font-black mb-4 tracking-tighter text-gradient leading-tight">
								{selectedProposal.title}
							</h1>
							<div className="flex items-center gap-4 text-xs font-black uppercase tracking-widest">
								<span className="text-brand-cyan">By {selectedProposal.author}</span>
								<span className="w-1.5 h-1.5 bg-white/10 rounded-full" />
								<span className="text-white/40">Ends {selectedProposal.endDate}</span>
							</div>
						</div>
						<div className="px-6 py-2 bg-brand-cyan/10 border border-brand-cyan/30 rounded-full">
							<span className="text-brand-cyan text-xs font-black uppercase tracking-widest">
								{selectedProposal.status}
							</span>
						</div>
					</div>

					<div className="glass-card p-12 rounded-[3.5rem] border border-white/5 mb-16">
						<div className="prose prose-invert prose-lg max-w-none text-white/60 leading-relaxed font-medium">
							{selectedProposal.description.split("\n").map((para, i) => (
								<p key={i} className="mb-4">
									{para}
								</p>
							))}
						</div>
					</div>

					<div className="grid grid-cols-2 gap-8 mb-20">
						<div className="glass-card p-10 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
							<div className="absolute top-0 left-0 w-full h-1 bg-brand-emerald/40" />
							<p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-2">
								For
							</p>
							<h3 className="text-3xl font-black">
								{selectedProposal.votesFor.toLocaleString()} LRN
							</h3>
						</div>
						<div className="glass-card p-10 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
							<div className="absolute top-0 left-0 w-full h-1 bg-brand-purple/40" />
							<p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-2">
								Against
							</p>
							<h3 className="text-3xl font-black text-white/60">
								{selectedProposal.votesAgainst.toLocaleString()} LRN
							</h3>
						</div>
					</div>
				</header>

				<CommentSection
					proposalId={selectedProposal.id}
					proposalAuthor={selectedProposal.author}
				/>
			</div>
		)
	}

	if (MOCK_PROPOSALS.length === 0) {
		return (
			<div className="p-12 max-w-5xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
				<header className="mb-16 text-center">
					<h1 className="text-6xl font-black mb-4 tracking-tighter text-gradient">
						{t("pages.dao.title")}
					</h1>
					<p className="text-white/40 text-lg font-medium">
						{t("pages.dao.desc")}
					</p>
				</header>
				{/* Issue #44 — No proposals empty state */}
				<NoProposalsEmptyState />
			</div>
		)
	}

	return (
		<div className="p-12 max-w-5xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
			<header className="mb-20 text-center">
				<h1 className="text-7xl font-black mb-6 tracking-tighter text-gradient">
					{t("pages.dao.title", "Governance")}
				</h1>
				<p className="text-white/40 text-xl font-medium max-w-2xl mx-auto leading-relaxed">
					{t(
						"pages.dao.desc",
						"Shape the future of LearnVault. Vote on protocol upgrades, treasury allocations, and ecosystem incentives.",
					)}
				</p>
			</header>

			<div className="grid gap-8">
				{MOCK_PROPOSALS.map((proposal) => (
					<div
						key={proposal.id}
						onClick={() => setSelectedProposal(proposal)}
						className="glass-card p-12 rounded-[3.5rem] border border-white/5 hover:border-brand-cyan/30 hover:-translate-y-2 transition-all duration-500 cursor-pointer group"
					>
						<div className="flex justify-between items-start mb-8">
							<h2 className="text-3xl font-black group-hover:text-brand-cyan transition-colors tracking-tight">
								{proposal.title}
							</h2>
							<span className="px-4 py-1.5 bg-white/5 text-[10px] font-black uppercase tracking-widest rounded-full border border-white/10">
								{proposal.status}
							</span>
						</div>

						<div className="flex items-center gap-6">
							<div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
								<div
									className="h-full bg-brand-cyan shadow-[0_0_15px_rgba(0,255,240,0.5)]"
									style={{
										width: `${(proposal.votesFor / (proposal.votesFor + proposal.votesAgainst)) * 100}%`,
									}}
								/>
							</div>
							<div className="text-[10px] font-black uppercase tracking-widest text-white/40">
								{Math.round(
									(proposal.votesFor /
										(proposal.votesFor + proposal.votesAgainst)) *
										100,
								)}
								% Passing
							</div>
						</div>
					</div>
				))}
			</div>

			<div className="mt-20 glass-card p-12 rounded-[3.5rem] border border-white/5 text-center bg-brand-purple/5 border-brand-purple/20">
				<h3 className="text-xl font-black mb-4">Voting Power</h3>
				<p className="text-white/40 text-sm mb-6">
					You have 250 LRN tokens available for voting.
				</p>
				<button className="px-10 py-4 bg-brand-purple text-white font-black uppercase tracking-widest rounded-full shadow-2xl shadow-brand-purple/40 hover:scale-105 transition-all">
					Delegate Power
				</button>
			</div>
		</div>
	)
}

export default Dao