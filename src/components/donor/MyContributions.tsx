import React from "react"
import { type DonorContribution } from "../../hooks/useDonor"

interface MyContributionsProps {
	contributions: DonorContribution[]
	totalContributed: number
}

export const MyContributions: React.FC<MyContributionsProps> = ({
	contributions,
	totalContributed,
}) => {
	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr)
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		})
	}

	return (
		<section className="mb-20">
			<div className="flex items-center gap-4 mb-12">
				<h2 className="text-2xl font-black tracking-tight">My Contributions</h2>
				<div className="h-px flex-1 bg-linear-to-r from-white/10 to-transparent" />
			</div>

			<div className="glass-card p-10 rounded-[3rem] border border-white/5 mb-12">
				<div className="flex items-baseline justify-between mb-8">
					<h3 className="text-sm text-white/40 uppercase font-black tracking-widest">
						Total Deposited
					</h3>
					<p className="text-4xl font-black text-gradient">
						${totalContributed.toLocaleString()}
					</p>
				</div>
				<div className="h-px bg-white/5" />
				<p className="text-xs mt-8 text-white/40 font-medium">
					Help us shape the future of decentralized education. Your
					contributions unlock governance voting power.
				</p>
			</div>

			{contributions.length > 0 ? (
				<div className="space-y-4">
					{contributions.map((contribution) => (
						<div
							key={contribution.txHash}
							className="glass-card p-8 rounded-2xl border border-white/5 hover:border-brand-cyan/30 transition-all hover:-translate-y-1"
						>
							<div className="flex items-center justify-between mb-4">
								<div>
									<p className="text-sm font-black text-white mb-1">
										${contribution.amount.toLocaleString()}
									</p>
									<p className="text-xs text-white/40 uppercase font-black tracking-widest">
										{formatDate(contribution.date)}
									</p>
								</div>
								<div className="text-right">
									<p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-2">
										Transaction Hash
									</p>
									<a
										href={`https://stellar.expert/explorer/testnet/tx/${contribution.txHash}`}
										target="_blank"
										rel="noopener noreferrer"
										className="text-xs font-mono text-brand-cyan hover:text-brand-blue transition-colors break-all"
									>
										{contribution.txHash}
									</a>
								</div>
							</div>
							<div className="flex items-center gap-2 text-[10px] text-white/20">
								<span>Block {contribution.block}</span>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="glass-card p-12 rounded-[3rem] border border-white/5 text-center">
					<p className="text-white/40 font-medium">
						No contributions yet. Make your first deposit to support scholars.
					</p>
				</div>
			)}
		</section>
	)
}
