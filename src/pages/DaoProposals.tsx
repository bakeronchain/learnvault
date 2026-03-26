import React, { useEffect, useMemo, useState } from "react"
import { Helmet } from "react-helmet"
import { useSearchParams } from "react-router-dom"
import Pagination from "../components/Pagination"
import { useGovernance, type Proposal } from "../hooks/useGovernance"

type FilterType = "Active" | "Passed" | "Rejected" | "All"

const filterGroupLabelId = "dao-proposals-filter-label"
const voteHelpId = "dao-proposals-vote-help"

const shortenAddress = (address: string) => {
	if (!address) return ""
	if (address.includes("...")) return address
	if (address.length <= 10) return address
	return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const getTimeRemaining = (endDate: number) => {
	// If endDate is a ledger sequence, this is simplified.
	// In a real app we'd multiply by average block time or fetch current ledger.
	// For now, let's treat it as a placeholder.
	if (!endDate) return "Unknown"
	return "Active"
}

const ITEMS_PER_PAGE = 5

const DaoProposals: React.FC = () => {
	const [searchParams, setSearchParams] = useSearchParams()
	const {
		proposals,
		votingPower,
		castVote,
		isVoting,
		hasVoted,
		isLoadingProposals,
	} = useGovernance()

	const parsedPage = parseInt(searchParams.get("page") || "1", 10)
	const currentPage = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage

	const [filter, setFilter] = useState<FilterType>("Active")
	const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(
		null,
	)

	const filteredProposals = useMemo(() => {
		if (filter === "All") return proposals
		return proposals.filter((p) => p.status === filter)
	}, [filter, proposals])

	const totalPages = Math.max(
		1,
		Math.ceil(filteredProposals.length / ITEMS_PER_PAGE),
	)
	const safePage = Math.min(currentPage, totalPages)

	const startIndex = (safePage - 1) * ITEMS_PER_PAGE
	const currentProposals = filteredProposals.slice(
		startIndex,
		startIndex + ITEMS_PER_PAGE,
	)

	useEffect(() => {
		if (currentPage !== safePage) {
			setSearchParams({ page: safePage.toString() })
		}
	}, [currentPage, safePage, setSearchParams])

	// Auto-select first proposal if none selected or if filter changes
	useEffect(() => {
		if (
			filteredProposals.length > 0 &&
			(!selectedProposal ||
				!filteredProposals.find((p) => p.id === selectedProposal.id))
		) {
			setSelectedProposal(filteredProposals[0] ?? null)
		} else if (filteredProposals.length === 0) {
			setSelectedProposal(null)
		}
	}, [filteredProposals, selectedProposal])

	const handleVote = async (support: boolean) => {
		if (!selectedProposal) return
		await castVote(selectedProposal.id, support)
	}

	const handlePageChange = (newPage: number) => {
		setSearchParams({ page: newPage.toString() })
		window.scrollTo({ top: 0, behavior: "smooth" })
	}

	const totalVotes = selectedProposal
		? selectedProposal.votesFor + selectedProposal.votesAgainst
		: 0n
	const yesPercent =
		totalVotes > 0n
			? Number((selectedProposal!.votesFor * 100n) / totalVotes)
			: 0
	const noPercent =
		totalVotes > 0n
			? Number((selectedProposal!.votesAgainst * 100n) / totalVotes)
			: 0

	const userHasVoted = selectedProposal ? hasVoted(selectedProposal.id) : false
	const governanceTokens = votingPower
	const isTokenHolder = governanceTokens > 0n
	const voteDisabled =
		!selectedProposal ||
		userHasVoted ||
		selectedProposal.status !== "Active" ||
		!isTokenHolder

	const getVoteDisabledMessage = () => {
		if (!selectedProposal) return ""
		if (!isTokenHolder) return "You must hold GOV tokens to vote."
		if (userHasVoted) return "You have already cast your vote."
		if (selectedProposal.status !== "Active")
			return "Voting is closed for this proposal."
		return ""
	}

	const siteUrl = "https://learnvault.app"
	const title = selectedProposal
		? `${selectedProposal.title} — LearnVault DAO`
		: "DAO Proposals — LearnVault"

	if (isLoadingProposals) {
		return (
			<div className="p-12 max-w-5xl mx-auto text-center h-[60vh] flex flex-col items-center justify-center">
				<div className="w-12 h-12 border-4 border-brand-cyan/20 border-t-brand-cyan rounded-full animate-spin mb-4" />
				<p className="text-white/60 font-medium">
					Loading Governance Proposals...
				</p>
			</div>
		)
	}

	return (
		<div className="p-12 max-w-5xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
			<Helmet>
				<title>{title}</title>
			</Helmet>

			<header className="mb-16 text-center">
				<h1 className="text-6xl font-black mb-4 tracking-tighter text-gradient">
					DAO Proposals
				</h1>
				<p className="text-white/70 text-lg font-medium max-w-2xl mx-auto">
					Review scholarship proposals and cast your vote with GOV tokens.
				</p>
			</header>

			<div className="flex flex-wrap gap-3 mb-8 justify-center">
				{(["Active", "Passed", "Rejected", "All"] as FilterType[]).map(
					(item) => (
						<button
							key={item}
							onClick={() => {
								setFilter(item)
								setSearchParams({ page: "1" })
							}}
							className={`px-5 py-2.5 rounded-full border text-xs font-black uppercase tracking-widest transition-all ${
								filter === item
									? "bg-brand-cyan/10 border-brand-cyan/40 text-brand-cyan"
									: "bg-white/5 border-white/10 text-white/70 hover:border-brand-cyan/30"
							}`}
						>
							{item}
						</button>
					),
				)}
			</div>

			{selectedProposal && (
				<section className="glass-card p-10 rounded-[2.5rem] border border-white/5 mb-10">
					<div className="flex justify-between items-start gap-6 mb-6">
						<div>
							<h2 className="text-4xl font-black tracking-tight mb-3">
								{selectedProposal.title}
							</h2>
							<div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest">
								<span className="text-brand-cyan">
									Applicant {shortenAddress(selectedProposal.author)}
								</span>
								<span className="w-1.5 h-1.5 bg-white/20 rounded-full" />
								<span className="text-white/70">ID #{selectedProposal.id}</span>
							</div>
						</div>
						<div className="px-5 py-2 bg-brand-cyan/10 border border-brand-cyan/30 rounded-full text-brand-cyan text-xs font-black uppercase">
							{selectedProposal.status}
						</div>
					</div>

					<div className="grid gap-8 md:grid-cols-2">
						<div>
							<h3 className="text-xl font-black mb-3">Description</h3>
							<p className="text-white/70 leading-relaxed mb-8">
								{selectedProposal.description}
							</p>

							<div className="rounded-[1.75rem] border border-white/5 bg-white/5 p-6">
								<p className="text-[10px] text-white/70 uppercase font-black tracking-widest mb-2">
									My Voting Power
								</p>
								<h3 className="text-2xl font-black">
									{governanceTokens.toString()} GOV
								</h3>
							</div>
						</div>

						<div>
							<h3 className="text-xl font-black mb-4">Voting Stats</h3>
							<div className="mb-6">
								<div className="flex justify-between text-xs font-black uppercase tracking-widest mb-2">
									<span>YES {yesPercent}%</span>
									<span>NO {noPercent}%</span>
								</div>
								<div className="w-full h-3 rounded-full bg-white/5 overflow-hidden flex">
									<div
										className="h-full bg-brand-cyan"
										style={{ width: `${yesPercent}%` }}
									/>
									<div
										className="h-full bg-brand-purple"
										style={{ width: `${noPercent}%` }}
									/>
								</div>
							</div>

							<div className="space-y-3 mb-8 text-sm text-white/60">
								<p>For: {selectedProposal.votesFor.toString()} GOV</p>
								<p>Against: {selectedProposal.votesAgainst.toString()} GOV</p>
								<p>Status: {userHasVoted ? "Voted" : "Not Voted"}</p>
							</div>

							<div className="flex gap-3">
								<button
									onClick={() => handleVote(true)}
									disabled={voteDisabled || isVoting}
									className="px-8 py-3 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan font-black uppercase tracking-widest rounded-full hover:bg-brand-cyan/20 disabled:opacity-30 transition-all font-bold"
								>
									{isVoting ? "Voting..." : "Vote YES"}
								</button>
								<button
									onClick={() => handleVote(false)}
									disabled={voteDisabled || isVoting}
									className="px-8 py-3 bg-brand-purple/10 border border-brand-purple/30 text-brand-purple font-black uppercase tracking-widest rounded-full hover:bg-brand-purple/20 disabled:opacity-30 transition-all font-bold"
								>
									{isVoting ? "Voting..." : "Vote NO"}
								</button>
							</div>
							{getVoteDisabledMessage() && (
								<p className="mt-4 text-xs text-white/40 font-medium italic">
									{getVoteDisabledMessage()}
								</p>
							)}
						</div>
					</div>
				</section>
			)}

			<div className="grid gap-6">
				{currentProposals.map((proposal) => (
					<button
						key={proposal.id}
						onClick={() => setSelectedProposal(proposal)}
						className={`glass-card p-8 rounded-[2.5rem] border text-left transition-all ${
							selectedProposal?.id === proposal.id
								? "border-brand-cyan/40"
								: "border-white/5 hover:border-brand-cyan/20"
						}`}
					>
						<div className="flex justify-between items-start mb-4">
							<h2 className="text-2xl font-black mb-1">{proposal.title}</h2>
							<span className="px-3 py-1 bg-white/5 text-[10px] uppercase font-black rounded-full border border-white/10">
								{proposal.status}
							</span>
						</div>
						<p className="text-sm text-white/60 mb-5 line-clamp-2">
							{proposal.description}
						</p>
						<div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-white/40">
							<span>For: {proposal.votesFor.toString()}</span>
							<span>Against: {proposal.votesAgainst.toString()}</span>
							<span className="ml-auto text-brand-cyan">View Details →</span>
						</div>
					</button>
				))}
			</div>

			{filteredProposals.length === 0 && (
				<div className="py-20 text-center opacity-50">
					<p>No proposals found for this filter.</p>
				</div>
			)}

			<Pagination
				page={safePage}
				totalPages={totalPages}
				onPageChange={handlePageChange}
			/>
		</div>
	)
}

export default DaoProposals
