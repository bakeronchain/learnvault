import React, { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useWallet } from "../hooks/useWallet"
import { shortenAddr, type LeaderboardEntry } from "../util/mockLeaderboardData"
import { formatLRN } from "../util/tokenFormat"

const PAGE_SIZE = 25

type TimeFilter = "all" | "month" | "week"

const MEDAL: Record<number, { emoji: string; color: string; glow: string }> = {
	1: { emoji: "🥇", color: "text-yellow-400", glow: "shadow-yellow-500/30" },
	2: { emoji: "🥈", color: "text-slate-300", glow: "shadow-slate-400/30" },
	3: { emoji: "🥉", color: "text-orange-400", glow: "shadow-orange-500/30" },
}

function avatarLetters(address: string): string {
	return address.length >= 2
		? `${address[0]}${address[address.length - 1]}`
		: "??"
}

interface RowProps {
	entry: LeaderboardEntry & { rank: number }
	isMine: boolean
	onClick: () => void
	isMyRankBanner?: boolean
}

type LeaderboardApiEntry = {
	rank: number
	address: string
	lrn_balance: string
	courses_completed: number
}

const LeaderboardRow: React.FC<RowProps> = ({
	entry,
	isMine,
	onClick,
	isMyRankBanner,
}) => {
	const medal = MEDAL[entry.rank]
	const rowBg = isMine
		? "bg-brand-cyan/10 border-brand-cyan/30"
		: medal
			? "bg-white/5 border-white/10"
			: "bg-transparent border-white/5"

	return (
		<tr
			onClick={onClick}
			className={`
				border-b ${rowBg} cursor-pointer transition-all duration-200
				hover:bg-white/10 group
				${isMyRankBanner ? "sticky bottom-0 z-20 backdrop-blur-xl" : ""}
			`}
		>
			{/* Rank */}
			<td className="px-4 py-4 whitespace-nowrap">
				<div
					className={`flex items-center gap-2 font-black text-lg ${medal ? medal.color : "text-white/40"}`}
				>
					{medal ? (
						<span className="text-2xl">{medal.emoji}</span>
					) : (
						<span className="text-sm w-8 text-center">{entry.rank}</span>
					)}
				</div>
			</td>

			{/* Avatar + Address */}
			<td className="px-4 py-4 whitespace-nowrap">
				<div className="flex items-center gap-3">
					<div
						className={`
						w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0
						${medal ? `bg-gradient-to-br from-white/20 to-white/5 shadow-lg ${medal.glow}` : "bg-white/10"}
						${isMine ? "bg-brand-cyan/20 text-brand-cyan" : ""}
					`}
					>
						{avatarLetters(entry.address)}
					</div>
					<span className="font-mono text-sm text-white/70 group-hover:text-white transition-colors">
						{shortenAddr(entry.address)}
					</span>
					{isMine && (
						<span className="text-[10px] font-black uppercase tracking-widest text-brand-cyan bg-brand-cyan/10 px-2 py-0.5 rounded-full border border-brand-cyan/30">
							You
						</span>
					)}
				</div>
			</td>

			{/* LRN Balance */}
			<td className="px-4 py-4 whitespace-nowrap text-right">
				<span
					className={`font-black text-sm ${medal ? medal.color : "text-white/80"}`}
				>
					{formatLRN(BigInt(entry.lrnBalance))} LRN
				</span>
			</td>

			{/* Courses Completed */}
			<td className="px-4 py-4 whitespace-nowrap text-center">
				<span className="font-mono text-sm text-white/60">
					{entry.coursesCompleted}
				</span>
			</td>

			{/* Joined */}
			<td className="px-4 py-4 whitespace-nowrap text-right text-xs text-white/40 font-medium">
				{entry.joinedDate.toLocaleDateString()}
			</td>
		</tr>
	)
}

const Leaderboard: React.FC = () => {
	const { t } = useTranslation()
	const { address: currentUserAddress } = useWallet()
	const [leaders, setLeaders] = useState<LeaderboardEntry[]>([])
	const [myRank, setMyRank] = useState<number | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		const fetchLeaderboard = async () => {
			try {
				const response = await fetch(
					"http://localhost:4000/api/scholars/leaderboard?page=1&limit=25",
				)
				if (!response.ok) throw new Error("Failed to fetch leaderboard")
				const result = (await response.json()) as {
					rankings?: LeaderboardApiEntry[]
					your_rank?: number | null
				}
				const rankings = Array.isArray(result.rankings) ? result.rankings : []
				const mapped = rankings.map((item, index) => ({
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
				setLeaders(mapped)
				setMyRank(typeof result.your_rank === "number" ? result.your_rank : null)
			} catch (err) {
				console.error(err)
				setError("Unable to load rankings. Please try again later.")
			} finally {
				setIsLoading(false)
			}
		}

		fetchLeaderboard()
	}, [])

	const leaderboardRows = useMemo(
		() =>
			leaders.map((leader, index) => ({
				...leader,
				rank: (leader as LeaderboardEntry & { rank?: number }).rank ?? index + 1,
				balance: String((leader as LeaderboardEntry & { balance?: string }).balance ?? leader.lrnBalance),
				completedCourses:
					(leader as LeaderboardEntry & { completedCourses?: number }).completedCourses ??
					leader.coursesCompleted,
				fullAddress:
					(leader as LeaderboardEntry & { fullAddress?: string }).fullAddress ??
					leader.address,
			})),
		[leaders],
	)

	const isCurrentUser = (fullAddress: string) => {
		return currentUserAddress?.toLowerCase() === fullAddress.toLowerCase()
	}

	return (
		<div className="p-6 md:p-12 max-w-6xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
			{/* Header */}
			<header className="mb-12 text-center">
				<h1 className="text-5xl md:text-6xl font-black mb-4 tracking-tighter text-gradient">
					{t("pages.leaderboard.title")}
				</h1>
				<p className="text-white/40 text-lg font-medium">
					{t("pages.leaderboard.desc")}
				</p>
			</header>

			{isLoading ? (
				<div className="glass-card p-20 rounded-[4rem] text-center border border-white/5">
					<div className="text-6xl mb-8 animate-bounce">🏆</div>
					<h2 className="text-3xl font-black mb-4">Synchronizing Data</h2>
					<p className="text-white/40 max-w-md mx-auto mb-10 leading-relaxed font-medium">
						Retrieving real-time scholar rankings from the Stellar network...
					</p>
					<div className="flex justify-center gap-3">
						<div className="w-3 h-3 bg-brand-cyan rounded-full animate-pulse" />
						<div className="w-3 h-3 bg-brand-blue rounded-full animate-pulse delay-75" />
						<div className="w-3 h-3 bg-brand-purple rounded-full animate-pulse delay-150" />
					</div>
				</div>
			) : error ? (
				<div className="glass-card p-20 rounded-[4rem] text-center border border-red-500/20 bg-red-500/5">
					<div className="text-6xl mb-8">⚠️</div>
					<h2 className="text-3xl font-black mb-4 text-red-400">Connection Error</h2>
					<p className="text-white/60 max-w-md mx-auto mb-6 font-medium">
						{error}
					</p>
					<button 
						onClick={() => window.location.reload()}
						className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-full font-bold transition-all"
					>
						Try Again
					</button>
				</div>
			) : leaderboardRows.length === 0 ? (
				<div className="glass-card p-20 rounded-[4rem] text-center border border-white/5">
					<div className="text-6xl mb-8">🌑</div>
					<h2 className="text-3xl font-black mb-4">Empty Leaderboard</h2>
					<p className="text-white/40 max-w-md mx-auto font-medium">
						No scholars have earned LRN tokens yet. Be the first to complete a course!
					</p>
				</div>
			) : (
				<div className="glass-card overflow-hidden rounded-[2.5rem] border border-white/5 shadow-2xl">
					<table className="w-full text-left border-collapse">
						<thead>
							<tr className="bg-white/5 border-b border-white/5">
								<th className="py-6 px-8 text-sm font-bold uppercase tracking-widest text-white/40">Rank</th>
								<th className="py-6 px-8 text-sm font-bold uppercase tracking-widest text-white/40">Scholar</th>
								<th className="py-6 px-8 text-sm font-bold uppercase tracking-widest text-white/40 text-right">LRN Balance</th>
								<th className="py-6 px-8 text-sm font-bold uppercase tracking-widest text-white/40 text-right">Milestones</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-white/5">
							{leaderboardRows.map((leader) => (
								<tr 
									key={leader.fullAddress}
									className={`group hover:bg-white/[0.02] transition-colors ${
										isCurrentUser(leader.fullAddress) ? "bg-brand-cyan/10" : ""
									}`}
								>
									<td className="py-6 px-8">
										<div className={`
											w-10 h-10 rounded-full flex items-center justify-center font-black text-lg
											${leader.rank === 1 ? "bg-yellow-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.3)]" : 
											  leader.rank === 2 ? "bg-slate-300 text-black" : 
											  leader.rank === 3 ? "bg-amber-600 text-black" : 
											  "bg-white/10 text-white/60"}
										`}>
											{leader.rank}
										</div>
									</td>
									<td className="py-6 px-8 overflow-hidden">
										<div className="flex items-center gap-4">
											<div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-cyan to-brand-purple flex-shrink-0 opacity-80" />
											<div>
												<div className="font-bold text-white group-hover:text-brand-cyan transition-colors">
													{leader.address}
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
											<span className="text-xs ml-1 text-white/20 uppercase">LRN</span>
										</div>
									</td>
									<td className="py-6 px-8 text-right">
										<div className="inline-flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/5">
											<span className="text-white/60 font-medium">{leader.completedCourses}</span>
											<span className="w-2 h-2 bg-brand-purple rounded-full" />
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
					
					<div className="p-8 bg-white/5 border-t border-white/5 flex justify-between items-center">
						<div className="text-sm font-medium text-white/40">
							Showing {leaderboardRows.length} top learners
							{myRank ? ` • Your rank: #${myRank}` : ""}
						</div>
						<div className="text-[10px] uppercase tracking-widest font-black text-white/20">
							Updated every block
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

export default Leaderboard
