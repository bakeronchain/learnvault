import React from "react"

interface GovernancePowerProps {
	balance: number
	percentage: number
}

export const GovernancePower: React.FC<GovernancePowerProps> = ({
	balance,
	percentage,
}) => {
	const getVisualization = (pct: number) => {
		if (pct < 0.5) return "text-white/30"
		if (pct < 1) return "text-brand-blue"
		if (pct < 2) return "text-brand-cyan"
		return "text-brand-emerald"
	}

	const getTier = (pct: number) => {
		if (pct < 0.1) return "Supporter"
		if (pct < 0.5) return "Contributor"
		if (pct < 1) return "Major Donor"
		if (pct < 5) return "Whale"
		return "Founder"
	}

	return (
		<section className="mb-20">
			<div className="flex items-center gap-4 mb-12">
				<h2 className="text-2xl font-black tracking-tight">Governance Power</h2>
				<div className="h-px flex-1 bg-linear-to-r from-white/10 to-transparent" />
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
				{/* Balance Card */}
				<div className="glass-card p-10 rounded-[3rem] border border-white/5 relative overflow-hidden group">
					<div className="absolute top-0 right-0 w-32 h-32 bg-brand-cyan/10 blur-[60px] rounded-full -z-10 group-hover:bg-brand-cyan/20 transition-colors" />

					<div className="flex items-baseline justify-between mb-6">
						<h3 className="text-sm text-white/40 uppercase font-black tracking-widest">
							Governance Token Balance
						</h3>
						<span className="text-[10px] font-black uppercase tracking-widest text-brand-cyan px-3 py-1 bg-brand-cyan/10 rounded-full border border-brand-cyan/30">
							{getTier(percentage)}
						</span>
					</div>
					<p className="text-5xl font-black text-gradient mb-4">
						{balance.toLocaleString()}
					</p>
					<p className="text-xs text-white/40 font-medium">
						Governance Token (GOV) — 1 GOV = 1 vote in DAO decisions
					</p>
				</div>

				{/* Percentage Card */}
				<div className="glass-card p-10 rounded-[3rem] border border-white/5 relative overflow-hidden group">
					<div className="absolute top-0 right-0 w-32 h-32 bg-brand-purple/10 blur-[60px] rounded-full -z-10 group-hover:bg-brand-purple/20 transition-colors" />

					<div className="mb-6">
						<h3 className="text-sm text-white/40 uppercase font-black tracking-widest mb-4">
							Of Total Supply
						</h3>
						<div className="flex items-baseline gap-3">
							<p
								className={`text-5xl font-black ${getVisualization(percentage)}`}
							>
								{percentage.toFixed(2)}%
							</p>
						</div>
					</div>
					<div className="space-y-4">
						<div className="flex items-center justify-between text-[10px]">
							<span className="text-white/40 uppercase font-black tracking-widest">
								Voting power
							</span>
							<span className="text-brand-cyan font-black">
								{balance.toLocaleString()} votes
							</span>
						</div>
						<div className="h-2 bg-white/5 rounded-full overflow-hidden">
							<div
								className={`h-full ${getVisualization(percentage)} opacity-60 shadow-[0_0_10px_currentColor]`}
								style={{
									width: `${Math.min(100, percentage * 50)}%`,
								}}
							/>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
