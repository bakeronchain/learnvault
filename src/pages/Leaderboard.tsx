import { ChevronLeft, ChevronRight, Trophy } from "lucide-react"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import AddressDisplay from "../components/AddressDisplay"
import { EmptyState } from "../components/states/emptyState"
import { ErrorState } from "../components/states/errorState"
import { useLeaderboard } from "../hooks/useLeaderboard"
import { useWallet } from "../hooks/useWallet"
import { type LeaderboardEntry } from "../util/mockLeaderboardData"

const PAGE_SIZE = 10

const Leaderboard: React.FC = () => {
	const { t } = useTranslation()
	const { address: currentUserAddress } = useWallet()
	const [page, setPage] = useState(1)

	const {
		data: result,
		isLoading,
		error,
		refetch,
	} = useLeaderboard(currentUserAddress, page, PAGE_SIZE)

	const leaders = useMemo(() => {
		const rankings = Array.isArray(result?.rankings) ? result.rankings : []
		return rankings.map((item, index) => ({
			id: `leader-${item.address}-${item.rank}-${index}`,
			address: item.address,
			lrnBalance: Number(item.lrn_balance ?? 0),
			coursesCompleted: item.courses_completed ?? 0,
			joinedDate: new Date(),
			lastActive: new Date(),
			rank: item.rank,
			balance: item.lrn_balance ?? "0",
			completedCourses: item.courses_completed ?? 0,
			fullAddress: item.address,
		}))
	}, [result?.rankings])

	const myRank = result?.your_rank ?? null
	const total = Number(result?.total ?? leaders.length ?? 0)
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

	const leaderboardRows = useMemo(
		() =>
			leaders.map((leader, index) => ({
				...leader,
				rank:
					(leader as LeaderboardEntry & { rank?: number }).rank ?? index + 1,
				balance: String(
					(leader as LeaderboardEntry & { balance?: string }).balance ??
						leader.lrnBalance,
				),
				completedCourses:
					(leader as LeaderboardEntry & { completedCourses?: number })
						.completedCourses ?? leader.coursesCompleted,
				fullAddress:
					(leader as LeaderboardEntry & { fullAddress?: string }).fullAddress ??
					leader.address,
			})),
		[leaders],
	)

	const isCurrentUser = (fullAddress: string) =>
		currentUserAddress?.toLowerCase() === fullAddress.toLowerCase()

	const prevPage = () => {
		setPage((current) => Math.max(1, current - 1))
	}

	const nextPage = () => {
		setPage((current) => Math.min(totalPages, current + 1))
	}

	return (
		<div className="p-6 md:p-12 max-w-6xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
			<header className="mb-12 text-center">
				<h1 className="text-5xl md:text-6xl font-black mb-4 tracking-tighter text-gradient">
					{t("pages.leaderboard.title")}
				</h1>
				<p className="text-white/40 text-lg font-medium">
					{t("pages.leaderboard.desc")}
				</p>
			</header>

			{isLoading ? (
				<div className="space-y-4">
					{[...Array(3)].map((_, i) => (
						<div
							key={i}
							className="h-24 rounded-[2.5rem] bg-white/5 animate-pulse"
						/>
					))}
				</div>
			) : error ? (
				<ErrorState
					message={error instanceof Error ? error.message : String(error)}
					onRetry={() => void refetch()}
				/>
			) : leaderboardRows.length === 0 ? (
				<EmptyState
					icon={Trophy}
					title="No scholars yet"
					description="No scholars have earned LRN tokens yet. Be the first to complete a course!"
				/>
			) : (
				<div className="glass-card overflow-hidden rounded-[2.5rem] border border-white/5 shadow-2xl">
					<table className="w-full text-left border-collapse">
						<thead>
							<tr className="bg-white/5 border-b border-white/5">
								<th className="py-6 px-8 text-sm font-bold uppercase tracking-widest text-white/40">
									Rank
								</th>
								<th className="py-6 px-8 text-sm font-bold uppercase tracking-widest text-white/40">
									Scholar
								</th>
								<th className="py-6 px-8 text-sm font-bold uppercase tracking-widest text-white/40 text-right">
									LRN Balance
								</th>
								<th className="py-6 px-8 text-sm font-bold uppercase tracking-widest text-white/40 text-right">
									Milestones
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-white/5">
							{leaderboardRows.map((leader) => (
								<tr
									key={leader.fullAddress}
									data-testid="leaderboard-row"
									className={`group hover:bg-white/[0.02] transition-colors ${
										isCurrentUser(leader.fullAddress) ? "bg-brand-cyan/10" : ""
									}`}
								>
									<td className="py-6 px-8">
										<div
											data-testid="leaderboard-rank-badge"
											className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg ${
												leader.rank === 1
													? "bg-yellow-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.3)]"
													: leader.rank === 2
														? "bg-slate-300 text-black"
														: leader.rank === 3
															? "bg-amber-600 text-black"
															: "bg-white/10 text-white/60"
											}`}
										>
											{leader.rank}
										</div>
									</td>
									<td className="py-6 px-8 overflow-hidden">
										<div className="flex items-center gap-4">
											<div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-cyan to-brand-purple flex-shrink-0 opacity-80" />
											<div className="min-w-0">
												<div data-testid="leaderboard-address">
													<AddressDisplay
														address={leader.fullAddress}
														className="max-w-full"
														addressClassName="font-bold text-white group-hover:text-brand-cyan transition-colors"
														buttonClassName="h-6 w-6"
														showExplorerLink={false}
														showCopyButton={false}
														fullOnHover={false}
													/>
												</div>
												{isCurrentUser(leader.fullAddress) && (
													<span className="text-[10px] uppercase font-black tracking-tighter text-brand-cyan bg-brand-cyan/10 px-2 py-0.5 rounded">
														You
													</span>
												)}
											</div>
										</div>
									</td>
									<td className="py-6 px-8 text-right">
										<div className="text-2xl font-black text-brand-cyan">
											{leader.balance}
											<span className="text-xs ml-1 text-white/20 uppercase">
												LRN
											</span>
										</div>
									</td>
									<td className="py-6 px-8 text-right">
										<div className="inline-flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/5">
											<span className="text-white/60 font-medium">
												{leader.completedCourses}
											</span>
											<span className="w-2 h-2 bg-brand-purple rounded-full" />
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>

					<div className="p-6 bg-white/5 border-t border-white/5 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
						<div className="text-sm font-medium text-white/40">
							Showing {leaderboardRows.length} scholars
							{currentUserAddress ? (
								<span data-testid="leaderboard-your-rank">
									{" "}
									| Your rank: {myRank ? `#${myRank}` : "Unranked"}
								</span>
							) : null}
						</div>

						<div className="flex items-center gap-3">
							<button
								type="button"
								data-testid="leaderboard-prev-page"
								onClick={prevPage}
								disabled={page <= 1}
								className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white/70 hover:text-white hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed"
							>
								<ChevronLeft className="h-4 w-4" />
								Prev
							</button>
							<span
								data-testid="leaderboard-page-indicator"
								className="text-xs uppercase tracking-widest text-white/40 font-black"
							>
								Page {page} of {totalPages}
							</span>
							<button
								type="button"
								data-testid="leaderboard-next-page"
								onClick={nextPage}
								disabled={page >= totalPages}
								className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white/70 hover:text-white hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed"
							>
								Next
								<ChevronRight className="h-4 w-4" />
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

export default Leaderboard
