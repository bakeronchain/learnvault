import React, { Suspense } from "react"
import React, { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
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
import { EmptyState } from "../components/states/emptyState"
import { ErrorState } from "../components/states/errorState"
import TxHashLink from "../components/TxHashLink"
import { useTreasury } from "../hooks/useTreasury"
import { DashboardStatsSkeleton, EmptyState } from "../components/SkeletonLoader"
import TreasuryHealthChart, {
	type TreasuryPoint,
} from "../components/treasury/TreasuryHealthChart"
import { useContractIds } from "../hooks/useContractIds"
import { useUSDC } from "../hooks/useUSDC"

const API_BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:4000"
const CHART_WINDOW_DAYS = 7
const STROOPS_PER_USDC = 10000000

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

interface TreasuryActivityResponse {
	events?: TreasuryEvent[]
	error?: string
}

const fetchJson = async <T,>(url: string): Promise<T> => {
	const response = await fetch(url)
	const data = (await response.json().catch(() => ({}))) as T & {
		error?: string
	}

	if (!response.ok) {
		throw new Error(data.error || `Request failed for ${url}`)
	}

	return data as T
}

const startOfDay = (value: Date) =>
	new Date(value.getFullYear(), value.getMonth(), value.getDate())

const formatDayLabel = (value: Date) =>
	value.toLocaleDateString("en-US", { weekday: "short" })

const parseAmount = (amount?: string) => {
	const parsed = Number(amount ?? "0")
	if (!Number.isFinite(parsed)) return 0
	return parsed / STROOPS_PER_USDC
}

const buildTreasuryChartData = (events: TreasuryEvent[]): TreasuryPoint[] => {
	const today = startOfDay(new Date())
	const buckets = new Map<
		string,
		{ name: string; inflows: number; outflows: number }
	>()

	for (let offset = CHART_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
		const day = new Date(today)
		day.setDate(today.getDate() - offset)
		const key = day.toISOString().slice(0, 10)
		buckets.set(key, {
			name: formatDayLabel(day),
			inflows: 0,
			outflows: 0,
		})
	}

	for (const event of events) {
		const timestamp = new Date(event.created_at)
		if (Number.isNaN(timestamp.getTime())) continue

		const day = startOfDay(timestamp).toISOString().slice(0, 10)
		const bucket = buckets.get(day)
		if (!bucket) continue

		const amount = parseAmount(event.amount)
		if (event.type === "deposit") {
			bucket.inflows += amount
		} else if (event.type === "disburse") {
			bucket.outflows += amount
		}
	}

	return Array.from(buckets.values())
}

const Treasury: React.FC = () => {
const { stats, activity, isLoading, isError } = useTreasury()

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
	const { scholarshipTreasury } = useContractIds()
	const { balance: treasuryUSDC, isLoading: treasuryLoading } =
		useUSDC(scholarshipTreasury)

	const [stats, setStats] = useState<TreasuryStats | null>(null)
	const [activity, setActivity] = useState<TreasuryEvent[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const fetchTreasuryData = async () => {
		try {
			setError(null)
			setLoading(true)

			const [statsRes, activityRes] = await Promise.all([
				fetch(`${API_BASE}/api/treasury/stats`),
				fetch(`${API_BASE}/api/treasury/activity?limit=20`),
			])

			if (statsRes.ok) {
				const statsData = await statsRes.json()
				setStats(statsData)
			} else {
				const payload = await statsRes.json().catch(() => ({}))
				throw new Error(
					payload.message || payload.error || "Failed to load treasury stats",
				)
			}

			if (activityRes.ok) {
				const activityData = await activityRes.json()
				setActivity(activityData.events || [])
			} else {
				const payload = await activityRes.json().catch(() => ({}))
				throw new Error(
					payload.message ||
						payload.error ||
						"Failed to load treasury activity",
				)
			}
		} catch (err) {
			console.error("Failed to fetch treasury data:", err)
			setError(
				err instanceof Error ? err.message : "Failed to load treasury data",
			)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		void fetchTreasuryData()
	}, [])

	const activity = activityResponse?.events ?? []

	const chartData = useMemo(
		() => buildTreasuryChartData(activity),
		[activity],
	)

	const hasChartData = chartData.some(
		(point) => point.inflows > 0 || point.outflows > 0,
	)

	const formatUSDC = (stroops: string) => {
		const usdc = Number(stroops) / STROOPS_PER_USDC
		return usdc.toLocaleString("en-US", {
			minimumFractionDigits: 0,
			maximumFractionDigits: 2,
		})
	}

	const formatAmount = (stroops: string) => {
		return parseAmount(stroops).toLocaleString("en-US", {
			minimumFractionDigits: 0,
			maximumFractionDigits: 2,
		})
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
totalTreasury: `${formatUSDC(stats.total_deposited_usdc)} USDC`,
totalDisbursed: `${formatUSDC(stats.total_disbursed_usdc)} USDC`,
scholarsFunded: stats.scholars_funded.toString(),
donorsCount: stats.donors_count.toString(),
}
: {
totalTreasury: isLoading ? "Loading…" : "0 USDC",
totalDisbursed: isLoading ? "Loading…" : "0 USDC",
scholarsFunded: isLoading ? "..." : "0",
donorsCount: isLoading ? "..." : "0",
}

const deposits = (activity ?? [])
.filter((e) => e.type === "deposit")
.slice(0, 2)
const disbursements = (activity ?? [])
.filter((e) => e.type === "disburse")
.slice(0, 2)

const siteUrl = "https://learnvault.app"
const title = `Treasury - ${displayStats.totalTreasury} - ${displayStats.scholarsFunded} Scholars Funded - LearnVault`
const description = `LearnVault's decentralized scholarship treasury holds ${displayStats.totalTreasury} and has funded ${displayStats.scholarsFunded} scholars. View real-time inflows and disbursements.`

const chartData = [
{ name: "Mon", inflows: 4000, outflows: 2400 },
{ name: "Tue", inflows: 3000, outflows: 1398 },
{ name: "Wed", inflows: 2000, outflows: 9800 },
{ name: "Thu", inflows: 2780, outflows: 3908 },
{ name: "Fri", inflows: 1890, outflows: 4800 },
{ name: "Sat", inflows: 2390, outflows: 3800 },
{ name: "Sun", inflows: 3490, outflows: 4300 },
]

return (
<div className="p-12 max-w-7xl mx-auto min-h-screen text-white animate-in fade-in duration-1000">
<Helmet>
<title>{title}</title>
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:image" content={`${siteUrl}/og-image.png`} />
<meta property="og:url" content={`${siteUrl}/treasury`} />
<meta name="twitter:card" content="summary_large_image" />
</Helmet>
	const formatTime = (timestamp: string) => {
		const date = new Date(timestamp)
		if (Number.isNaN(date.getTime())) return "Unknown time"

		const now = new Date()
		const diffMs = now.getTime() - date.getTime()
		const diffMins = Math.floor(diffMs / 60000)
		const diffHours = Math.floor(diffMins / 60)
		const diffDays = Math.floor(diffHours / 24)

		if (diffMins < 60) return `${Math.max(diffMins, 0)}m ago`
		if (diffHours < 24) return `${diffHours}h ago`
		return `${diffDays}d ago`
	}

	const siteUrl = "https://learnvault.app"

	const displayStats = stats
		? {
				totalTreasury: treasuryLoading
					? "Loading..."
					: treasuryUSDC !== undefined
						? `${treasuryUSDC.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
						: `${formatUSDC(stats.total_deposited_usdc)} USDC`,
				totalDisbursed: `${formatUSDC(stats.total_disbursed_usdc)} USDC`,
				scholarsFunded: stats.scholars_funded.toString(),
				donorsCount: stats.donors_count.toString(),
			}
		: {
				totalTreasury: treasuryLoading
					? "Loading..."
					: treasuryUSDC !== undefined
						? `${treasuryUSDC.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
						: statsError
							? "Unavailable"
							: "Loading...",
				totalDisbursed: statsLoading ? "Loading..." : "Unavailable",
				scholarsFunded: statsLoading ? "..." : "—",
				donorsCount: statsLoading ? "..." : "—",
			}

	if (loading || treasuryLoading) {
		return (
			<div className="p-12 max-w-7xl mx-auto min-h-screen text-white animate-in fade-in duration-1000">
				<div className="flex flex-col items-center justify-center h-[60vh]">
					<div className="w-12 h-12 border-4 border-brand-cyan/20 border-t-brand-cyan rounded-full animate-spin mb-4" />
					<p className="text-white/60 font-medium">Loading treasury data...</p>
				</div>
			</div>
		)
	}
	const deposits = activity.filter((event) => event.type === "deposit").slice(0, 5)
	const disbursements = activity
		.filter((event) => event.type === "disburse")
		.slice(0, 5)

	if (error) {
		return (
			<div className="p-12 max-w-7xl mx-auto min-h-screen text-white animate-in fade-in duration-1000">
				<ErrorState message={error} onRetry={() => void fetchTreasuryData()} />
			</div>
		)
	}

	return (
		<div className="p-12 max-w-7xl mx-auto min-h-screen text-white animate-in fade-in duration-1000">
			<Helmet>
				<title>{`Treasury - ${displayStats.totalTreasury}`}</title>
				<meta
					property="og:title"
					content={`Treasury - ${displayStats.totalTreasury}`}
				/>
				<meta
					property="og:description"
					content="LearnVault's decentralized scholarship treasury holds funds and tracks grants."
				/>
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

{isLoading ? (
<DashboardStatsSkeleton />
) : isError ? (
<div className="glass-card p-8 rounded-[3rem] border border-white/5 text-center text-red-400">
Failed to load treasury stats.
</div>
) : (
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
)}

			<div className="mb-20">
				<div className="glass-card p-10 rounded-[3rem] relative overflow-hidden">
					<div className="flex justify-between items-end mb-12">
						<div>
							<h3 className="text-3xl font-black mb-2">Treasury Health</h3>
							<p className="text-white/40 text-sm">
								Actual treasury inflows and outflows from recent on-chain
								activity.
							</p>
						</div>
						<div className="flex gap-6">
							<LegendItem color="#00d2ff" label="Inflows" />
							<LegendItem color="#8e2de2" label="Outflows" />
						</div>
					</div>
					<div className="w-full h-[400px]">
						{activityLoading ? (
							<ChartSkeleton />
						) : activityError ? (
							<ChartState
								title="Unable to load treasury history"
								description={
									activityError instanceof Error
										? activityError.message
										: "Please try again in a moment."
								}
								actionLabel="Retry"
								onAction={() => void refetchActivity()}
							/>
						) : !hasChartData ? (
							<ChartState
								title="No treasury history yet"
								description="Deposits and disbursements will appear here once on-chain treasury activity is available."
							/>
						) : (
							<TreasuryHealthChart data={chartData} />
						)}
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
				{activity.length === 0 ? (
					<div className="lg:col-span-2">
						<EmptyState
							icon="📭"
							title="No treasury transactions yet"
							description="No deposits or disbursements have been recorded yet. Check back soon for updates."
							ctaLabel="Refresh"
							ctaHref="#"
						/>
					</div>
				) : (
					<>
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
					</>
				)}
			</div>

<div className="mt-20 text-center">
<button className="iridescent-border px-12 py-5 rounded-2xl font-black text-lg uppercase tracking-widest hover:scale-105 active:scale-95 transition-all group overflow-hidden shadow-2xl shadow-brand-cyan/20">
<span className="relative z-10">Donate to Treasury</span>
</button>
</div>
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

const ChartSkeleton = () => (
	<div className="h-full rounded-[2rem] border border-white/5 bg-white/5 p-8 animate-pulse">
		<div className="flex h-full items-end gap-4">
			<div className="h-24 w-full rounded-full bg-white/5" />
			<div className="h-36 w-full rounded-full bg-white/5" />
			<div className="h-20 w-full rounded-full bg-white/5" />
			<div className="h-48 w-full rounded-full bg-white/5" />
			<div className="h-28 w-full rounded-full bg-white/5" />
			<div className="h-40 w-full rounded-full bg-white/5" />
			<div className="h-32 w-full rounded-full bg-white/5" />
		</div>
	</div>
)

const ChartState: React.FC<{
	title: string
	description: string
	actionLabel?: string
	onAction?: () => void
}> = ({ title, description, actionLabel, onAction }) => (
	<div className="flex h-full flex-col items-center justify-center rounded-[2rem] border border-dashed border-white/10 bg-white/[0.03] px-8 text-center">
		<h4 className="text-xl font-black text-white">{title}</h4>
		<p className="mt-3 max-w-xl text-sm text-white/50">{description}</p>
		{actionLabel && onAction ? (
			<button
				onClick={onAction}
				className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-brand-cyan transition-colors hover:bg-white/10"
			>
				{actionLabel}
			</button>
		) : null}
	</div>
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
	error?: string
	emptyMessage?: string
}> = ({
	title,
	items,
	loading = false,
	error,
	emptyMessage = "No activity yet",
}) => (
	<div className="glass p-8 rounded-[2.5rem] border border-white/5">
		<h3 className="text-xl font-black mb-8 border-l-4 border-brand-cyan pl-4">
			{title}
		</h3>
		<div className="flex flex-col gap-4">
			{loading ? (
				<div className="space-y-4 py-2">
					{Array.from({ length: 3 }).map((_, index) => (
						<div
							key={index}
							className="rounded-2xl border border-white/5 bg-white/5 p-5 animate-pulse"
						>
							<div className="h-4 w-24 rounded-full bg-white/10" />
							<div className="mt-3 h-3 w-16 rounded-full bg-white/5" />
							<div className="mt-4 h-4 w-28 rounded-full bg-white/10" />
						</div>
					))}
				</div>
			) : error ? (
				<div className="text-center text-white/40 py-8">{error}</div>
			) : items.length === 0 ? (
				<div className="text-center text-white/40 py-8">{emptyMessage}</div>
			) : (
				items.map((item, i) => (
					<div
						key={`${item.txHash}-${i}`}
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
