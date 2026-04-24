import React, { Suspense, useEffect, useState } from "react"
import { Helmet } from "react-helmet"
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts"
import TxHashLink from "../components/TxHashLink"
import { ActivityFeedSkeleton } from "../components/SkeletonLoader"
import { useContractIds } from "../hooks/useContractIds"
import { useUSDC } from "../hooks/useUSDC"

const API_BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:4000"

interface TreasuryStats {
	total_deposited_usdc: string
	total_disbursed_usdc: string
	scholars_funded: number
	active_proposals: number
	donors_count: number
}

interface TreasuryEvent {
	type: "deposit" | "disburse"
	amount?: string
	address?: string
	scholar?: string
	tx_hash: string
	created_at: string
}

const Treasury: React.FC = () => {
	const { scholarshipTreasury } = useContractIds()
	const { balance: treasuryUSDC, isLoading: treasuryLoading } =
		useUSDC(scholarshipTreasury)

	const [stats, setStats] = useState<TreasuryStats | null>(null)
	const [activity, setActivity] = useState<TreasuryEvent[]>([])
	const [loading, setLoading] = useState(true)

	interface ScholarshipMetrics {
		active_scholarships: number
		total_scholars: number
		completion_rate: number
		avg_milestones_per_scholar: number
		dropout_rate: number
		total_usdc_disbursed: number
	}

	const [scholarshipMetrics, setScholarshipMetrics] =
		useState<ScholarshipMetrics | null>(null)

	useEffect(() => {
		const fetchTreasuryData = async () => {
			try {
				const [statsRes, activityRes, metricsRes] = await Promise.all([
					fetch(`${API_BASE}/api/treasury/stats`),
					fetch(`${API_BASE}/api/treasury/activity?limit=20`),
					fetch(`${API_BASE}/api/scholarships/metrics`),
				])

				if (statsRes.ok) {
					const statsData = await statsRes.json()
					setStats(statsData)
				}

				if (activityRes.ok) {
					const activityData = await activityRes.json()
					setActivity(activityData.events || [])
				}

				if (metricsRes.ok) {
					const metricsData = await metricsRes.json()
					setScholarshipMetrics(metricsData)
				}
			} catch (err) {
				console.error("Failed to fetch treasury data:", err)
			} finally {
				setLoading(false)
			}
		}

		void fetchTreasuryData()
	}, [])

	const data = [
		{ name: "Mon", inflows: 4000, outflows: 2400 },
		{ name: "Tue", inflows: 3000, outflows: 1398 },
		{ name: "Wed", inflows: 2000, outflows: 9800 },
		{ name: "Thu", inflows: 2780, outflows: 3908 },
		{ name: "Fri", inflows: 1890, outflows: 4800 },
		{ name: "Sat", inflows: 2390, outflows: 3800 },
		{ name: "Sun", inflows: 3490, outflows: 4300 },
	]

	const formatUSDC = (stroops: string) => {
		const usdc = Number(stroops) / 10000000
		return usdc.toLocaleString("en-US", {
			minimumFractionDigits: 0,
			maximumFractionDigits: 2,
		})
	}

	const formatAmount = (stroops: string) => {
		const usdc = Number(stroops) / 10000000
		return usdc.toLocaleString("en-US", {
			minimumFractionDigits: 0,
			maximumFractionDigits: 2,
		})
	}

	const formatAddress = (address: string) => {
		if (address.length <= 8) return address
		return `${address.slice(0, 4)}...${address.slice(-4)}`
	}

	const formatTime = (timestamp: string) => {
		const date = new Date(timestamp)
		const now = new Date()
		const diffMs = now.getTime() - date.getTime()
		const diffMins = Math.floor(diffMs / 60000)
		const diffHours = Math.floor(diffMins / 60)
		const diffDays = Math.floor(diffHours / 24)

		if (diffMins < 60) return `${diffMins}m ago`
		if (diffHours < 24) return `${diffHours}h ago`
		return `${diffDays}d ago`
	}

	const displayStats = stats
		? {
				// Use contract balance if available, otherwise use API data
				totalTreasury: treasuryLoading
					? "Loading…"
					: treasuryUSDC !== undefined
						? `${treasuryUSDC.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
						: `${formatUSDC(stats.total_deposited_usdc)} USDC`,
				totalDisbursed: `${formatUSDC(stats.total_disbursed_usdc)} USDC`,
				scholarsFunded: stats.scholars_funded.toString(),
				donorsCount: stats.donors_count.toString(),
			}
		: {
				totalTreasury: treasuryLoading
					? "Loading…"
					: treasuryUSDC !== undefined
						? `${treasuryUSDC.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
						: "Loading...",
				totalDisbursed: "Loading...",
				scholarsFunded: "...",
				donorsCount: "...",
			}

	const deposits = activity.filter((e) => e.type === "deposit").slice(0, 2)
	const disbursements = activity
		.filter((e) => e.type === "disburse")
		.slice(0, 2)

	const siteUrl = "https://learnvault.app"
	const title = `Treasury - ${displayStats.totalTreasury} - ${displayStats.scholarsFunded} Scholars Funded - LearnVault`
	const description = `LearnVault's decentralized scholarship treasury holds ${displayStats.totalTreasury} and has funded ${displayStats.scholarsFunded} scholars. View real-time inflows and disbursements.`

	return (
		<div aria-busy={loading} className="p-12 max-w-7xl mx-auto min-h-screen text-white animate-in fade-in duration-1000">
			<Helmet>
				<title>{title}</title>
				<meta property="og:title" content={title} />
				<meta property="og:description" content={description} />
				<meta property="og:image" content={`${siteUrl}/og-image.png`} />
				<meta property="og:url" content={`${siteUrl}/treasury`} />
				<meta name="twitter:card" content="summary_large_image" />
			</Helmet>

			<header className="text-center mb-20 relative">
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-brand-cyan/20 blur-[100px] rounded-full -z-10" />
				<h1 className="text-7xl font-black mb-4 tracking-tighter text-gradient">
					Treasury Dashboard
				</h1>
				<p className="text-white/40 text-lg max-w-2xl mx-auto font-medium">
					Real-time transparency into the LearnVault decentralized scholarship
					fund.
				</p>
			</header>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
				<StatCard
					label="Total in Treasury"
					value={displayStats.totalTreasury}
					icon={"\u{1F4B0}"}
					color="text-brand-cyan"
				/>
				<StatCard
					label="Total Disbursed"
					value={displayStats.totalDisbursed}
					icon={"\u{1F4B8}"}
					color="text-brand-purple"
				/>
				<StatCard
					label="Scholars Funded"
					value={displayStats.scholarsFunded}
					icon={"\u{1F393}"}
					color="text-brand-emerald"
				/>
				<StatCard
					label="Global Donors"
					value={displayStats.donorsCount}
					icon={"\u{1F30D}"}
					color="text-brand-blue"
				/>
			</div>

			<div className="mb-20">
				<div className="glass-card p-10 rounded-[3rem] relative overflow-hidden">
					<div className="flex justify-between items-end mb-12">
						<div>
							<h3 className="text-3xl font-black mb-2">Treasury Health</h3>
							<p className="text-white/40 text-sm">
								Comparison of community inflows vs scholarship outflows.
							</p>
						</div>
						<div className="flex gap-6">
							<LegendItem color="#00d2ff" label="Inflows" />
							<LegendItem color="#8e2de2" label="Outflows" />
						</div>
					</div>
					<div className="w-full h-[400px]">
						<Suspense
							fallback={
								<div className="h-full animate-pulse rounded-[2rem] border border-white/5 bg-white/5" />
							}
						>
							<TreasuryHealthChart data={data} />
						</Suspense>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
				<ActivityFeed
					title="Recent Community Deposits"
					items={deposits.map((event) => ({
						user: formatAddress(event.address || "unknown"),
						amount: `+${formatAmount(event.amount || "0")} USDC`,
						time: formatTime(event.created_at),
						type: "deposit" as const,
						txHash: event.tx_hash,
					}))}
					loading={loading}
				/>
				<ActivityFeed
					title="Latest Disbursements"
					items={disbursements.map((event) => ({
						user: formatAddress(event.scholar || "unknown"),
						amount: `-${formatAmount(event.amount || "0")} USDC`,
						time: formatTime(event.created_at),
						type: "disburse" as const,
						txHash: event.tx_hash,
					}))}
					loading={loading}
				/>
			</div>

			<div className="mt-20 text-center">
				<button className="iridescent-border px-12 py-5 rounded-2xl font-black text-lg uppercase tracking-widest hover:scale-105 active:scale-95 transition-all group overflow-hidden shadow-2xl shadow-brand-cyan/20">
					<span className="relative z-10">Donate to Treasury</span>
				</button>
			</div>

			{/* Scholarship Program Metrics */}
			<section aria-busy={loading} className="mt-20">
				<h2 className="text-4xl font-black mb-2 tracking-tighter">
					Scholarship Program
				</h2>
				<p className="text-white/40 text-sm mb-10">
					Real-time health metrics for the active scholarship cohort.
				</p>

				{loading && (
					<div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
						{Array.from({ length: 6 }).map((_, i) => (
							<div
								key={i}
								className="h-28 rounded-3xl bg-white/5 animate-pulse"
							/>
						))}
					</div>
				)}

				{!loading && scholarshipMetrics && (
					<div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
						{[
							{
								label: "Active Scholarships",
								value: scholarshipMetrics.active_scholarships,
								icon: "🎓",
								color: "text-brand-cyan",
							},
							{
								label: "Total Scholars",
								value: scholarshipMetrics.total_scholars,
								icon: "👩‍🎓",
								color: "text-brand-blue",
							},
							{
								label: "Completion Rate",
								value: `${scholarshipMetrics.completion_rate}%`,
								icon: "✅",
								color: "text-brand-emerald",
							},
							{
								label: "Avg Milestones / Scholar",
								value: scholarshipMetrics.avg_milestones_per_scholar,
								icon: "📊",
								color: "text-white",
							},
							{
								label: "Dropout Rate",
								value: `${scholarshipMetrics.dropout_rate}%`,
								icon: "⚠️",
								color: "text-red-400",
							},
							{
								label: "Total USDC Disbursed",
								value: `$${(scholarshipMetrics.total_usdc_disbursed / 1e7).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
								icon: "💸",
								color: "text-brand-purple",
							},
						].map(({ label, value, icon, color }) => (
							<StatCard
								key={label}
								label={label}
								value={String(value)}
								icon={icon}
								color={color}
							/>
						))}
					</div>
				)}

				{!loading && !scholarshipMetrics && (
					<p className="text-white/40 text-center py-10">
						Scholarship metrics unavailable
					</p>
				)}
			</section>
		</div>
	)
}

const StatCard: React.FC<{
	label: string
	value: string
	icon: string
	color: string
}> = ({ label, value, icon, color }) => (
	<div className="glass-card p-8 rounded-4xl hover:border-white/20 transition-all hover:-translate-y-2 group">
		<div className="text-3xl mb-4 group-hover:scale-125 transition-transform duration-500">
			{icon}
		</div>
		<p className="text-[10px] uppercase font-black text-white/30 tracking-[2px] mb-1">
			{label}
		</p>
		<p className={`text-2xl font-black ${color} tracking-tight`}>{value}</p>
	</div>
)

const LegendItem: React.FC<{ color: string; label: string }> = ({
	color,
	label,
}) => (
	<div className="flex items-center gap-2">
		<div
			className="w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]"
			style={{ backgroundColor: color }}
		/>
		<span className="text-xs font-bold text-white/60">{label}</span>
	</div>
)

const TreasuryHealthChart: React.FC<{
	data: { name: string; inflows: number; outflows: number }[]
}> = ({ data }) => (
	<ResponsiveContainer width="100%" height="100%">
		<AreaChart data={data}>
			<defs>
				<linearGradient id="inflowGradient" x1="0" y1="0" x2="0" y2="1">
					<stop offset="5%" stopColor="#00d2ff" stopOpacity={0.4} />
					<stop offset="95%" stopColor="#00d2ff" stopOpacity={0} />
				</linearGradient>
				<linearGradient id="outflowGradient" x1="0" y1="0" x2="0" y2="1">
					<stop offset="5%" stopColor="#8e2de2" stopOpacity={0.4} />
					<stop offset="95%" stopColor="#8e2de2" stopOpacity={0} />
				</linearGradient>
			</defs>
			<CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
			<XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" />
			<YAxis stroke="rgba(255,255,255,0.5)" />
			<Tooltip />
			<Area
				type="monotone"
				dataKey="inflows"
				stroke="#00d2ff"
				fill="url(#inflowGradient)"
			/>
			<Area
				type="monotone"
				dataKey="outflows"
				stroke="#8e2de2"
				fill="url(#outflowGradient)"
			/>
		</AreaChart>
	</ResponsiveContainer>
)

const ActivityFeed: React.FC<{
	title: string
	items: {
		user: string
		amount: string
		time: string
		type: "deposit" | "disburse"
		txHash: string
	}[]
	loading?: boolean
}> = ({ title, items, loading = false }) => (
	<div className="glass p-8 rounded-[2.5rem] border border-white/5">
		<h3 className="text-xl font-black mb-8 border-l-4 border-brand-cyan pl-4">
			{title}
		</h3>
		<div className="flex flex-col gap-4">
			{loading ? (
				<ActivityFeedSkeleton rows={2} />
			) : items.length === 0 ? (
				<div className="text-center text-white/40 py-8">No activity yet</div>
			) : (
				items.map((item, i) => (
					<div
						key={i}
						className="flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/[0.08] transition-colors group"
					>
						<div className="flex items-center gap-4">
							<div
								className={`w-2 h-2 rounded-full ${item.type === "deposit" ? "bg-brand-emerald animate-pulse" : "bg-brand-purple"}`}
							/>
							<div>
								<p className="font-bold text-sm">{item.user}</p>
								<p className="text-[10px] text-white/30 uppercase font-black tracking-widest">
									{item.time}
								</p>
								<TxHashLink
									hash={item.txHash}
									className="mt-2 inline-flex text-[10px] font-black uppercase tracking-widest text-brand-cyan hover:underline"
								/>
							</div>
						</div>
						<p
							className={`font-black ${item.type === "deposit" ? "text-brand-emerald" : "text-white/80"}`}
						>
							{item.amount}
						</p>
					</div>
				))
			)}
		</div>
	</div>
)

export default Treasury
