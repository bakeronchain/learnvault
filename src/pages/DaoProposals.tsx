import React, { useEffect, useMemo, useState } from "react"
import { Helmet } from "react-helmet"
import { useSearchParams } from "react-router-dom"
import CommentSection from "../components/CommentSection"
import Pagination from "../components/Pagination"
import {
	type ProposalRecord,
	useProposal,
	useProposals,
} from "../hooks/useProposals"

type FilterType =
	| "Voting Open"
	| "Voting Closed"
	| "Passed"
	| "Rejected"
	| "All"

const ITEMS_PER_PAGE = 5

const shortenAddress = (address: string) => {
	if (!address) return ""
	if (address.includes("...")) return address
	if (address.length <= 10) return address
	return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const formatCountdown = (deadline: string | null, now: number) => {
	if (!deadline) return "No deadline set"

	const diff = new Date(deadline).getTime() - now
	if (diff <= 0) return "Voting closed"

	const minutes = Math.floor(diff / (1000 * 60))
	const days = Math.floor(minutes / (60 * 24))
	const hours = Math.floor((minutes % (60 * 24)) / 60)
	const mins = minutes % 60

	if (days > 0) return `${days}d ${hours}h remaining`
	if (hours > 0) return `${hours}h ${mins}m remaining`
	return `${Math.max(mins, 1)}m remaining`
}

const formatTokenAmount = (value: bigint) => value.toString()

const getFilterValue = (proposal: ProposalRecord): FilterType => {
	if (proposal.displayStatus === "Voting Open") return "Voting Open"
	if (proposal.displayStatus === "Voting Closed") return "Voting Closed"
	if (proposal.displayStatus === "Passed") return "Passed"
	return "Rejected"
}

const DaoProposals: React.FC = () => {
	const [searchParams, setSearchParams] = useSearchParams()
	const [filter, setFilter] = useState<FilterType>("Voting Open")
	const [now, setNow] = useState(() => Date.now())
	const {
		proposals,
		votingPower,
		castVote,
		isVoting,
		walletAddress,
		isLoading,
	} = useProposals()

	const proposalParam = searchParams.get("proposal")
	const pageParam = searchParams.get("page")
	const parsedSelectedId = proposalParam
		? Number.parseInt(proposalParam, 10)
		: null
	const parsedPage = pageParam ? Number.parseInt(pageParam, 10) : 1
	const currentPage =
		Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage

	const filteredProposals = useMemo(() => {
		if (filter === "All") return proposals
		return proposals.filter((proposal) => getFilterValue(proposal) === filter)
	}, [filter, proposals])

	const totalPages = Math.max(
		1,
		Math.ceil(filteredProposals.length / ITEMS_PER_PAGE),
	)
	const safePage = Math.min(currentPage, totalPages)
	const currentProposals = filteredProposals.slice(
		(safePage - 1) * ITEMS_PER_PAGE,
		safePage * ITEMS_PER_PAGE,
	)

	const selectedFromList = useMemo(() => {
		if (parsedSelectedId === null || Number.isNaN(parsedSelectedId)) return null
		return (
			proposals.find((proposal) => proposal.id === parsedSelectedId) ?? null
		)
	}, [parsedSelectedId, proposals])

	const fallbackSelected = filteredProposals[0] ?? proposals[0] ?? null
	const selectedProposalId =
		selectedFromList?.id ?? fallbackSelected?.id ?? null
	const selectedProposalQuery = useProposal(selectedProposalId)
	const selectedProposal =
		selectedProposalQuery.data ?? selectedFromList ?? fallbackSelected ?? null

	useEffect(() => {
		const interval = window.setInterval(() => setNow(Date.now()), 60000)
		return () => window.clearInterval(interval)
	}, [])

	useEffect(() => {
		if (currentPage !== safePage) {
			const nextParams = new URLSearchParams(searchParams)
			nextParams.set("page", safePage.toString())
			setSearchParams(nextParams, { replace: true })
		}
	}, [currentPage, safePage, searchParams, setSearchParams])

	useEffect(() => {
		if (!selectedProposalId) return

		const nextParams = new URLSearchParams(searchParams)
		let changed = false

		if (nextParams.get("proposal") !== String(selectedProposalId)) {
			nextParams.set("proposal", String(selectedProposalId))
			changed = true
		}

		if (!nextParams.get("page")) {
			nextParams.set("page", "1")
			changed = true
		}

		if (changed) {
			setSearchParams(nextParams, { replace: true })
		}
	}, [searchParams, selectedProposalId, setSearchParams])

	useEffect(() => {
		if (!selectedFromList) return
		const matchingFilter = getFilterValue(selectedFromList)
		if (filter !== "All" && filter !== matchingFilter) {
			setFilter(matchingFilter)
		}
	}, [filter, selectedFromList])

	const handleSelectProposal = (proposalId: number) => {
		const nextParams = new URLSearchParams(searchParams)
		nextParams.set("proposal", String(proposalId))
		setSearchParams(nextParams)
	}

	const handlePageChange = (page: number) => {
		const nextParams = new URLSearchParams(searchParams)
		nextParams.set("page", String(page))
		setSearchParams(nextParams)
		window.scrollTo({ top: 0, behavior: "smooth" })
	}

	const handleFilterChange = (nextFilter: FilterType) => {
		setFilter(nextFilter)
		const nextParams = new URLSearchParams(searchParams)
		nextParams.set("page", "1")
		setSearchParams(nextParams)
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
	const userHasVoted =
		selectedProposal?.userVoteSupport === true ||
		selectedProposal?.userVoteSupport === false
	const voteChoice = selectedProposal?.userVoteSupport ?? null
	const isWalletConnected = Boolean(walletAddress)
	const isTokenHolder = votingPower > 0n
	const voteDisabled =
		!selectedProposal ||
		!selectedProposal.isVotingOpen ||
		!isWalletConnected ||
		!isTokenHolder ||
		userHasVoted

	const getVoteDisabledMessage = () => {
		if (!selectedProposal) return ""
		if (!isWalletConnected) return "Connect your wallet to vote."
		if (!isTokenHolder) return "You need governance tokens to vote."
		if (userHasVoted) return "You have already cast your vote on this proposal."
		if (!selectedProposal.isVotingOpen)
			return "Voting is closed for this proposal."
		return ""
	}

	const title = selectedProposal
		? `${selectedProposal.title} | LearnVault DAO`
		: "DAO Proposals | LearnVault"

	if (isLoading) {
		return (
			<div className="p-12 max-w-5xl mx-auto text-center h-[60vh] flex flex-col items-center justify-center">
				<div className="w-12 h-12 border-4 border-brand-cyan/20 border-t-brand-cyan rounded-full animate-spin mb-4" />
				<p className="text-white/60 font-medium">Loading proposals...</p>
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
					Review live governance proposals, track vote totals, and follow the
					discussion in real time.
				</p>
			</header>

			<div className="flex flex-wrap gap-3 mb-8 justify-center">
				{(
					[
						"Voting Open",
						"Voting Closed",
						"Passed",
						"Rejected",
						"All",
					] as FilterType[]
				).map((item) => (
					<button
						key={item}
						type="button"
						onClick={() => handleFilterChange(item)}
						className={`px-5 py-2.5 rounded-full border text-xs font-black uppercase tracking-widest transition-all ${
							filter === item
								? "bg-brand-cyan/10 border-brand-cyan/40 text-brand-cyan"
								: "bg-white/5 border-white/10 text-white/70 hover:border-brand-cyan/30"
						}`}
					>
						{item}
					</button>
				))}
			</div>

			{selectedProposal && (
				<section className="glass-card p-10 rounded-[2.5rem] border border-white/5 mb-10">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-8">
						<div>
							<h2
								className="text-4xl font-black tracking-tight mb-3"
								data-testid="proposal-detail-title"
							>
								{selectedProposal.title}
							</h2>
							<div className="flex flex-wrap items-center gap-3 text-xs font-black uppercase tracking-widest">
								<span className="text-brand-cyan">
									Applicant {shortenAddress(selectedProposal.authorAddress)}
								</span>
								<span className="w-1.5 h-1.5 bg-white/20 rounded-full" />
								<span className="text-white/70">ID #{selectedProposal.id}</span>
								<span className="w-1.5 h-1.5 bg-white/20 rounded-full" />
								<span className="text-white/50">
									{formatCountdown(selectedProposal.deadline, now)}
								</span>
							</div>
						</div>
						<div className="px-5 py-2 bg-brand-cyan/10 border border-brand-cyan/30 rounded-full text-brand-cyan text-xs font-black uppercase">
							{selectedProposal.displayStatus}
						</div>
					</div>

					<div className="grid gap-8 md:grid-cols-2">
						<div>
							<h3 className="text-xl font-black mb-3">Description</h3>
							<p className="text-white/70 leading-relaxed whitespace-pre-wrap mb-8">
								{selectedProposal.description}
							</p>

							<div className="grid gap-4 sm:grid-cols-2">
								<div className="rounded-[1.75rem] border border-white/5 bg-white/5 p-6">
									<p className="text-[10px] text-white/70 uppercase font-black tracking-widest mb-2">
										My Voting Power
									</p>
									<h3 className="text-2xl font-black">
										{formatTokenAmount(votingPower)} GOV
									</h3>
								</div>
								<div className="rounded-[1.75rem] border border-white/5 bg-white/5 p-6">
									<p className="text-[10px] text-white/70 uppercase font-black tracking-widest mb-2">
										Requested Amount
									</p>
									<h3 className="text-2xl font-black">
										{selectedProposal.amount.toLocaleString()} USDC
									</h3>
								</div>
							</div>
						</div>

						<div>
							<h3 className="text-xl font-black mb-4">Voting Stats</h3>
							<div className="mb-6">
								<div className="flex justify-between text-xs font-black uppercase tracking-widest mb-2">
									<span>Yes {yesPercent}%</span>
									<span>No {noPercent}%</span>
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
								<p>
									<span data-testid="vote-yes-count">
										Yes votes: {formatTokenAmount(selectedProposal.votesFor)}{" "}
										GOV
									</span>
								</p>
								<p>
									<span data-testid="vote-no-count">
										No votes: {formatTokenAmount(selectedProposal.votesAgainst)}{" "}
										GOV
									</span>
								</p>
								<p>
									Total voting power cast: {formatTokenAmount(totalVotes)} GOV
								</p>
								<p>{formatCountdown(selectedProposal.deadline, now)}</p>
							</div>

							{userHasVoted ? (
								<div className="inline-flex items-center px-4 py-2 rounded-full border border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan text-xs font-black uppercase tracking-widest">
									You voted {voteChoice ? "Yes" : "No"}
								</div>
							) : (
								<div className="flex gap-3">
									<button
										type="button"
										data-testid="vote-yes"
										onClick={() =>
											void castVote({
												proposalId: selectedProposal.id,
												support: true,
											})
										}
										disabled={voteDisabled || isVoting}
										className="px-8 py-3 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan font-black uppercase tracking-widest rounded-full hover:bg-brand-cyan/20 disabled:opacity-30 transition-all"
									>
										{isVoting ? "Voting..." : "Vote Yes"}
									</button>
									<button
										type="button"
										data-testid="vote-no"
										onClick={() =>
											void castVote({
												proposalId: selectedProposal.id,
												support: false,
											})
										}
										disabled={voteDisabled || isVoting}
										className="px-8 py-3 bg-brand-purple/10 border border-brand-purple/30 text-brand-purple font-black uppercase tracking-widest rounded-full hover:bg-brand-purple/20 disabled:opacity-30 transition-all"
									>
										{isVoting ? "Voting..." : "Vote No"}
									</button>
								</div>
							)}

							{getVoteDisabledMessage() && (
								<p className="mt-4 text-xs text-white/40 font-medium italic">
									{getVoteDisabledMessage()}
								</p>
							)}
						</div>
					</div>

					<CommentSection
						proposalId={String(selectedProposal.id)}
						proposalAuthor={selectedProposal.authorAddress}
					/>
				</section>
			)}

			<div className="grid gap-6">
				{currentProposals.map((proposal) => (
					<button
						key={proposal.id}
						type="button"
						onClick={() => handleSelectProposal(proposal.id)}
						className={`glass-card p-8 rounded-[2.5rem] border text-left transition-all ${
							selectedProposal?.id === proposal.id
								? "border-brand-cyan/40"
								: "border-white/5 hover:border-brand-cyan/20"
						}`}
					>
						<div className="flex justify-between items-start gap-4 mb-4">
							<div>
								<h2
									className="text-2xl font-black mb-1"
									data-testid="proposal-title"
								>
									{proposal.title}
								</h2>
								<p className="text-[10px] text-white/40 uppercase font-black tracking-widest">
									Applicant {shortenAddress(proposal.authorAddress)}
								</p>
							</div>
							<span className="px-3 py-1 bg-white/5 text-[10px] uppercase font-black rounded-full border border-white/10">
								{proposal.displayStatus}
							</span>
						</div>
						<p className="text-sm text-white/60 mb-5 line-clamp-2">
							{proposal.description}
						</p>
						<div className="flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-widest text-white/40">
							<span>Yes: {formatTokenAmount(proposal.votesFor)}</span>
							<span>No: {formatTokenAmount(proposal.votesAgainst)}</span>
							<span>{formatCountdown(proposal.deadline, now)}</span>
							<span className="ml-auto text-brand-cyan">View details</span>
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
