import React from "react"

interface Stat {
	label: string
	value: string
	icon: string
}

interface TreasuryStatsBarProps {
	stats?: Stat[]
}

const TreasuryStatsBar: React.FC<TreasuryStatsBarProps> = ({
	stats = defaultStats,
}) => {
	return (
		<div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				{stats.map((stat, index) => (
					<div key={index} className="text-center">
						<div className="text-3xl mb-2">{stat.icon}</div>
						<div className="text-2xl font-bold text-gray-900 mb-1">
							{stat.value}
						</div>
						<div className="text-sm text-gray-600 font-medium">
							{stat.label}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

// Default stats for V1 (hardcoded values)
const defaultStats: Stat[] = [
	{
		label: "Treasury",
		value: "/bin/zsh USDC",
		icon: "🏦",
	},
	{
		label: "Scholars Funded",
		value: "0",
		icon: "🎓",
	},
	{
		label: "Donors",
		value: "0",
		icon: "💙",
	},
	{
		label: "LRN Minted",
		value: "0",
		icon: "🏆",
	},
]

export default TreasuryStatsBar
