import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts"

export interface TreasuryPoint {
	name: string
	inflows: number
	outflows: number
}

interface TreasuryHealthChartProps {
	data: TreasuryPoint[]
}

const TreasuryHealthChart = ({ data }: TreasuryHealthChartProps) => (
	<ResponsiveContainer>
		<AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
			<defs>
				<linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
					<stop offset="5%" stopColor="#00d2ff" stopOpacity={0.3} />
					<stop offset="95%" stopColor="#00d2ff" stopOpacity={0} />
				</linearGradient>
				<linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
					<stop offset="5%" stopColor="#8e2de2" stopOpacity={0.3} />
					<stop offset="95%" stopColor="#8e2de2" stopOpacity={0} />
				</linearGradient>
			</defs>
			<CartesianGrid
				strokeDasharray="3 3"
				stroke="rgba(255,255,255,0.05)"
				vertical={false}
			/>
			<XAxis
				dataKey="name"
				stroke="rgba(255,255,255,0.2)"
				fontSize={12}
				tickLine={false}
				axisLine={false}
			/>
			<YAxis
				stroke="rgba(255,255,255,0.2)"
				fontSize={12}
				tickLine={false}
				axisLine={false}
				tickFormatter={(value) => `$${value / 1000}k`}
			/>
			<Tooltip
				contentStyle={{
					backgroundColor: "rgba(5, 7, 10, 0.9)",
					borderRadius: "16px",
					border: "1px solid rgba(255,255,255,0.1)",
					backdropFilter: "blur(10px)",
					boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
				}}
				itemStyle={{
					color: "#fff",
					fontSize: "12px",
					fontWeight: "bold",
				}}
			/>
			<Area
				type="monotone"
				dataKey="inflows"
				stroke="#00d2ff"
				strokeWidth={3}
				fillOpacity={1}
				fill="url(#colorIn)"
			/>
			<Area
				type="monotone"
				dataKey="outflows"
				stroke="#8e2de2"
				strokeWidth={3}
				fillOpacity={1}
				fill="url(#colorOut)"
			/>
		</AreaChart>
	</ResponsiveContainer>
)

export default TreasuryHealthChart
