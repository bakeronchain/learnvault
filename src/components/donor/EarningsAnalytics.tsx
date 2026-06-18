import {
	Area,
	CartesianGrid,
	ComposedChart,
	Legend,
	Line,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts"
import { useEarningsAnalytics } from "../../hooks/useEarningsAnalytics"
import { TrendingUp, Award, Zap, BarChart3, HelpCircle } from "lucide-react"

export function EarningsAnalytics() {
	const { data, summary, interval, setInterval, isLoading } = useEarningsAnalytics()

	const formatter = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	})

	const formatDecimal = (num: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			maximumFractionDigits: 2,
		}).format(num)
	}

	return (
		<div className="glass-card p-6 sm:p-8 rounded-[2rem] border border-white/8 relative overflow-hidden group shadow-2xl transition-all duration-300">
			{/* Ambient glows inside card */}
			<div className="absolute top-0 right-0 w-48 h-48 bg-brand-cyan/5 blur-3xl rounded-full pointer-events-none group-hover:bg-brand-cyan/8 transition-all" />
			<div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-purple/5 blur-3xl rounded-full pointer-events-none group-hover:bg-brand-purple/8 transition-all" />

			<div className="relative z-10 space-y-8">
				{/* Top Header & Selector */}
				<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
					<div className="space-y-1">
						<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-cyan/10 border border-brand-cyan/10 mb-2">
							<BarChart3 className="w-3.5 h-3.5 text-brand-cyan" />
							<span className="text-[10px] font-black uppercase tracking-widest text-brand-cyan">
								Analytics
							</span>
						</div>
						<h2 className="text-2xl sm:text-3xl font-black text-white">
							Earnings & Payout Timelines
						</h2>
						<p className="text-white/40 text-xs sm:text-sm font-medium">
							Track the historical USDC volume, gas overhead, and net educator/scholar royalties.
						</p>
					</div>

					{/* Time interval selectors */}
					<div className="flex gap-1.5 p-1 bg-white/5 border border-white/5 rounded-2xl shrink-0">
						{(["7d", "30d", "ytd"] as const).map((opt) => {
							const labels = { "7d": "7 Days", "30d": "30 Days", "ytd": "Year-To-Date" }
							const isActive = interval === opt
							return (
								<button
									key={opt}
									onClick={() => setInterval(opt)}
									className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
										isActive
											? "text-brand-cyan bg-brand-cyan/15 border border-brand-cyan/20 shadow-glow-cyan"
											: "text-white/50 hover:text-white bg-transparent border border-transparent hover:bg-white/5"
									}`}
								>
									{labels[opt]}
								</button>
							)
						})}
					</div>
				</div>

				{/* Summary Metrics Row */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<div className="glass-card p-5 rounded-2xl border border-white/5 hover:border-white/10 transition-all flex items-center gap-4">
						<div className="w-12 h-12 rounded-xl bg-brand-cyan/10 border border-brand-cyan/10 flex items-center justify-center shrink-0">
							<TrendingUp className="w-5 h-5 text-brand-cyan" />
						</div>
						<div>
							<p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
								Total Volume (USDC)
							</p>
							<p className="text-xl sm:text-2xl font-black text-white mt-0.5">
								{formatter.format(summary.totalVolume)}
							</p>
						</div>
					</div>

					<div className="glass-card p-5 rounded-2xl border border-white/5 hover:border-white/10 transition-all flex items-center gap-4">
						<div className="w-12 h-12 rounded-xl bg-brand-emerald/10 border border-brand-emerald/10 flex items-center justify-center shrink-0">
							<Award className="w-5 h-5 text-brand-emerald" />
						</div>
						<div>
							<p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
								Net Royalties
							</p>
							<p className="text-xl sm:text-2xl font-black text-white mt-0.5">
								{formatter.format(summary.totalNetRoyalties)}
							</p>
						</div>
					</div>

					<div className="glass-card p-5 rounded-2xl border border-white/5 hover:border-white/10 transition-all flex items-center gap-4">
						<div className="w-12 h-12 rounded-xl bg-brand-purple/10 border border-brand-purple/10 flex items-center justify-center shrink-0">
							<Zap className="w-5 h-5 text-brand-purple" />
						</div>
						<div>
							<p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
								Gas Overhead (XLM)
							</p>
							<p className="text-xl sm:text-2xl font-black text-white mt-0.5">
								{formatDecimal(summary.totalGasCosts)}
							</p>
						</div>
					</div>
				</div>

				{/* Chart Plot Visualizer */}
				<div className={`h-[350px] w-full bg-white/[0.01] border border-white/5 rounded-2xl p-4 transition-opacity duration-300 relative ${
					isLoading ? "opacity-50 pointer-events-none" : "opacity-100"
				}`}>
					{isLoading && (
						<div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-xs rounded-2xl z-20">
							<div className="animate-pulse text-xs font-black uppercase text-brand-cyan tracking-widest">
								Loading timelines...
							</div>
						</div>
					)}

					<ResponsiveContainer width="100%" height="100%">
						<ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
							<defs>
								<linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor="#00d2ff" stopOpacity={0.2} />
									<stop offset="95%" stopColor="#00d2ff" stopOpacity={0.0} />
								</linearGradient>
								<linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor="#00ff80" stopOpacity={0.2} />
									<stop offset="95%" stopColor="#00ff80" stopOpacity={0.0} />
								</linearGradient>
							</defs>
							<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
							<XAxis
								dataKey="date"
								stroke="rgba(255,255,255,0.3)"
								fontSize={10}
								fontFamily="monospace"
								tickLine={false}
								dy={10}
							/>
							<YAxis
								stroke="rgba(255,255,255,0.3)"
								fontSize={10}
								fontFamily="monospace"
								tickLine={false}
								dx={-5}
								tickFormatter={(value) => `$${value}`}
							/>
							<Tooltip content={<CustomTooltip />} />
							<Legend
								verticalAlign="top"
								height={36}
								iconType="circle"
								iconSize={8}
								wrapperStyle={{
									fontSize: 10,
									fontFamily: "monospace",
									textTransform: "uppercase",
									letterSpacing: 1,
									color: "rgba(255,255,255,0.6)",
									paddingBottom: 20,
								}}
							/>
							<Area
								name="Volume"
								type="monotone"
								dataKey="volume"
								stroke="#00d2ff"
								strokeWidth={2.5}
								fillOpacity={1}
								fill="url(#colorVolume)"
							/>
							<Area
								name="Net Royalties"
								type="monotone"
								dataKey="netRoyalties"
								stroke="#00ff80"
								strokeWidth={2}
								fillOpacity={1}
								fill="url(#colorNet)"
							/>
							<Line
								name="Gas Overhead"
								type="monotone"
								dataKey="gasCosts"
								stroke="#8e2de2"
								strokeWidth={2}
								dot={false}
								activeDot={{ r: 4 }}
							/>
						</ComposedChart>
					</ResponsiveContainer>
				</div>
			</div>
		</div>
	)
}

function CustomTooltip({ active, payload, label }: any) {
	if (!active || !payload || !payload.length) return null

	return (
		<div className="glass p-5 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl space-y-3 max-w-[240px] text-xs">
			<p className="font-mono text-white/50 text-[10px] uppercase tracking-widest border-b border-white/5 pb-2">
				Timeline: {label}
			</p>
			<div className="space-y-1.5 font-normal">
				{payload.map((entry: any) => {
					const labelColor = entry.name === "Volume" 
						? "text-brand-cyan" 
						: entry.name === "Net Royalties" 
							? "text-brand-emerald" 
							: "text-brand-purple"

					return (
						<div key={entry.name} className="flex justify-between items-center gap-6">
							<span className="text-white/40 flex items-center gap-1.5">
								<span className={`w-1.5 h-1.5 rounded-full ${entry.name === "Volume" ? "bg-brand-cyan" : entry.name === "Net Royalties" ? "bg-brand-emerald" : "bg-brand-purple"}`} />
								{entry.name}
							</span>
							<span className={`font-bold font-mono ${labelColor}`}>
								${entry.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
							</span>
						</div>
					)
				})}
			</div>
			{payload[0] && payload[0].payload.transactions && (
				<div className="pt-2 border-t border-white/5 flex justify-between items-center text-[10px] font-mono text-white/30">
					<span>TRANSACTIONS</span>
					<span className="font-bold text-white/50">
						{payload[0].payload.transactions} operations
					</span>
				</div>
			)}
		</div>
	)
}
