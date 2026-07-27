import { useState } from "react"
import { Link } from "react-router-dom"
import { Search, Plus, Coins, Filter } from "lucide-react"
import { useBounties } from "../hooks/useBounties"
import { useWallet } from "../hooks/useWallet"
import BountyCard from "../components/BountyCard"
import { EmptyState } from "../components/states/emptyState"
import Pagination from "../components/Pagination"
import type { BountyStatus } from "../types/bounty"

const STATUS_OPTIONS: { label: string; value: string }[] = [
	{ label: "All", value: "" },
	{ label: "Open", value: "open" },
	{ label: "Claimed", value: "claimed" },
	{ label: "Submitted", value: "submitted" },
	{ label: "Paid", value: "paid" },
]

export default function BountyBoard() {
	const { address } = useWallet()
	const [skillFilter, setSkillFilter] = useState("")
	const [statusFilter, setStatusFilter] = useState<BountyStatus | "">("")
	const [page, setPage] = useState(1)
	const [skillInput, setSkillInput] = useState("")

	const { data, isLoading, error } = useBounties({
		skill: skillFilter || undefined,
		status: statusFilter || undefined,
		page,
		pageSize: 12,
	})

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault()
		setSkillFilter(skillInput.trim().toLowerCase())
		setPage(1)
	}

	return (
		<div className="mx-auto w-full max-w-7xl px-6 py-12 sm:px-12">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
				<div>
					<h1 className="text-3xl font-black tracking-tight text-white">
						Bounty Board
					</h1>
					<p className="text-sm text-white/50 mt-1">
						Find paid coding tasks from sponsors, complete work, and earn USDC + LRN rewards.
					</p>
				</div>
				{address && (
					<Link
						to="/bounties/create"
						className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-cyan text-black font-bold rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all text-sm"
					>
						<Plus className="h-4 w-4" />
						Create Bounty
					</Link>
				)}
			</div>

			{/* Stats bar */}
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
				<div className="glass-card rounded-2xl border border-white/5 p-4">
					<div className="text-xs text-white/40 uppercase tracking-wider mb-1">Total</div>
					<div className="text-xl font-black text-white">{data?.pagination?.total ?? 0}</div>
				</div>
				<div className="glass-card rounded-2xl border border-white/5 p-4">
					<div className="text-xs text-white/40 uppercase tracking-wider mb-1">Open</div>
					<div className="text-xl font-black text-emerald-400">
						{data?.data?.filter((b) => b.status === "open").length ?? 0}
					</div>
				</div>
				<div className="glass-card rounded-2xl border border-white/5 p-4">
					<div className="text-xs text-white/40 uppercase tracking-wider mb-1">Avg Reward</div>
					<div className="flex items-center gap-1 text-xl font-black text-brand-emerald">
						<Coins className="h-4 w-4" />
						{data?.data?.length
							? Math.round(
								data.data.reduce((sum, b) => sum + Number(b.reward_usdc), 0) /
									data.data.length
							  )
							: 0}
					</div>
				</div>
				<div className="glass-card rounded-2xl border border-white/5 p-4">
					<div className="text-xs text-white/40 uppercase tracking-wider mb-1">Your Bounties</div>
					<div className="text-xl font-black text-white">
						{data?.data?.filter(
							(b) => address && b.claimed_by?.toLowerCase() === address.toLowerCase()
						).length ?? 0}
					</div>
				</div>
			</div>

			{/* Filters */}
			<div className="flex flex-col sm:flex-row gap-3 mb-6">
				<form onSubmit={handleSearch} className="flex gap-2 flex-1">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
						<input
							type="text"
							value={skillInput}
							onChange={(e) => setSkillInput(e.target.value)}
							placeholder="Filter by skill..."
							className="w-full pl-10 pr-4 py-2.5 glass rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-cyan/50 transition-colors"
						/>
					</div>
					<button
						type="submit"
						className="px-4 py-2.5 glass rounded-xl border border-white/10 text-white/70 text-sm font-medium hover:bg-white/10 transition-all"
					>
						<Filter className="h-4 w-4" />
					</button>
				</form>
				<div className="flex gap-1.5 flex-wrap">
					{STATUS_OPTIONS.map((opt) => (
						<button
							key={opt.value}
							onClick={() => {
								setStatusFilter(opt.value as BountyStatus | "")
								setPage(1)
							}}
							className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
								statusFilter === opt.value
									? "bg-brand-cyan text-black border-brand-cyan"
									: "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
							}`}
						>
							{opt.label}
						</button>
					))}
				</div>
			</div>

			{/* Content */}
			{isLoading ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<div
							key={i}
							className="h-52 rounded-[1.75rem] border border-white/5 bg-white/5 animate-pulse"
						/>
					))}
				</div>
			) : error ? (
				<div className="glass-card rounded-[2.5rem] border border-white/5 p-8 text-center">
					<p className="text-red-400 text-sm">Failed to load bounties. Please try again.</p>
				</div>
			) : data?.data?.length === 0 ? (
				<EmptyState
					icon={Coins}
					title="No bounties found"
					description={
						skillFilter || statusFilter
							? "Try adjusting your filters"
							: "Be the first sponsor to create a bounty!"
					}
					ctaLabel={address ? "Create Bounty" : undefined}
					ctaTo={address ? "/bounties/create" : undefined}
				/>
			) : (
				<>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{data?.data?.map((bounty) => (
							<BountyCard key={bounty.id} bounty={bounty} />
						))}
					</div>
					<Pagination
						page={page}
						totalPages={data?.pagination?.totalPages ?? 1}
						onPageChange={setPage}
					/>
				</>
			)}
		</div>
	)
}
