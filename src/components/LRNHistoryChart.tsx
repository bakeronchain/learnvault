import React, { useEffect, useState } from "react"
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
} from "recharts"

interface LRNEvent {
	timestamp: string
	amount: number
	cumulative: number
	course_id: string
	tx_hash: string | null
}

interface LRNHistoryChartProps {
	address: string | null | undefined
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000"

const LRNHistoryChart: React.FC<LRNHistoryChartProps> = ({ address }) => {
	const [history, setHistory] = useState<LRNEvent[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!address) return

		setLoading(true)
		setError(null)

		fetch(`${SERVER_URL}/api/scholars/${address}/lrn-history`)
			.then((res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`)
				return res.json() as Promise<{ history: LRNEvent[] }>
			})
			.then(({ history: data }) => setHistory(data))
			.catch(() => setError("Could not load LRN history"))
			.finally(() => setLoading(false))
	}, [address])

	if (!address) return null

	if (loading) {
		return (
			<div className="glass-card rounded-[2rem] p-8 animate-pulse">
				<div className="h-4 w-40 bg-white/10 rounded mb-6" />
				<div className="h-48 bg-white/5 rounded-xl" />
			</div>
		)
	}

	if (error) {
		return (
			<div className="glass-card rounded-[2rem] p-8 text-white/50 text-sm text-center">
				{error}
			</div>
		)
	}

	if (history.length === 0) {
		return (
			<div className="glass-card rounded-[2rem] p-8 text-center">
				<p className="text-white/40 text-sm uppercase tracking-widest font-black">
					No LRN history yet
				</p>
				<p className="text-white/25 text-xs mt-2">
					Complete milestones to start earning LRN tokens.
				</p>
			</div>
		)
	}

	const chartData = history.map((e) => ({
		date: new Date(e.timestamp).toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
		}),
		cumulative: e.cumulative,
		amount: e.amount,
	}))

	return (
		<div className="glass-card rounded-[2rem] p-8">
			<h3 className="text-lg font-black tracking-tighter mb-6 text-white">
				LRN Balance History
			</h3>
			<ResponsiveContainer width="100%" height={220}>
				<LineChart
					data={chartData}
					margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
				>
					<CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
					<XAxis
						dataKey="date"
						tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
						axisLine={false}
						tickLine={false}
					/>
					<YAxis
						tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
						axisLine={false}
						tickLine={false}
						width={48}
					/>
					<Tooltip
						contentStyle={{
							background: "#0b0e14",
							border: "1px solid rgba(255,255,255,0.1)",
							borderRadius: 12,
							color: "#fff",
							fontSize: 12,
						}}
						formatter={(value: number) => [
							value.toLocaleString(),
							"Cumulative LRN",
						]}
					/>
					<Line
						type="monotone"
						dataKey="cumulative"
						stroke="#00f0ff"
						strokeWidth={2}
						dot={{ r: 3, fill: "#00f0ff", strokeWidth: 0 }}
						activeDot={{ r: 5, fill: "#00f0ff" }}
					/>
				</LineChart>
			</ResponsiveContainer>
		</div>
	)
}

export default LRNHistoryChart
