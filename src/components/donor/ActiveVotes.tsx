import React from "react"
import { type Vote } from "../../hooks/useDonor"

interface ActiveVotesProps {
	votes: Vote[]
}

export const ActiveVotes: React.FC<ActiveVotesProps> = ({ votes }) => {
	const getStatusColor = (status: string) => {
		switch (status) {
			case "active":
				return "text-brand-cyan"
			case "passed":
				return "text-brand-emerald"
			case "rejected":
				return "text-brand-purple"
			default:
				return "text-white/40"
		}
	}

	const getStatusBg = (status: string) => {
		switch (status) {
			case "active":
				return "bg-brand-cyan/10 border-brand-cyan/30"
			case "passed":
				return "bg-brand-emerald/10 border-brand-emerald/30"
			case "rejected":
				return "bg-brand-purple/10 border-brand-purple/30"
			default:
				return "bg-white/5 border-white/10"
		}
	}

	return (
		<section className="mb-20">
			<div className="flex items-center gap-4 mb-12">
				<h2 className="text-2xl font-black tracking-tight">Active Votes</h2>
				<div className="h-px flex-1 bg-linear-to-r from-white/10 to-transparent" />
			</div>

			{votes.length > 0 ? (
				<div className="space-y-4">
					{votes.map((vote) => (
						<div
							key={vote.proposalId}
							className="glass-card p-8 rounded-[2.5rem] border border-white/5 hover:border-white/20 transition-all hover:-translate-y-1"
						>
							<div className="flex items-start justify-between mb-6">
								<div className="flex-1">
									<h3 className="text-lg font-black mb-2 tracking-tight">
										{vote.proposalTitle}
									</h3>
									<div className="flex items-center gap-3 flex-wrap">
										<span
											className={`text-xs uppercase font-black tracking-widest px-3 py-1 rounded-full border ${getStatusBg(vote.status)} ${getStatusColor(vote.status)}`}
										>
											{vote.status}
										</span>
										<span className="text-xs text-white/40 uppercase font-black tracking-widest">
											Proposal #{vote.proposalId}
										</span>
									</div>
								</div>
								<div className="text-right">
									<p className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-1">
										Your Vote
									</p>
									<p className="text-lg font-black text-gradient capitalize">
										{vote.voteChoice}
									</p>
								</div>
							</div>

							<div className="h-px bg-white/5 mb-6" />

							<div>
								<p className="text-xs text-white/40 uppercase font-black tracking-widest mb-3">
									Voting Power Used
								</p>
								<div className="flex items-center justify-between gap-4">
									<div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
										<div
											className="h-full bg-brand-cyan/60 shadow-[0_0_10px_rgba(0,210,255,0.4)]"
											style={{ width: "100%" }}
										/>
									</div>
									<span className="text-sm font-black text-brand-cyan">
										{vote.votePower.toLocaleString()}
									</span>
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="glass-card p-12 rounded-[3rem] border border-white/5 text-center">
					<div className="text-4xl mb-4">🗳️</div>
					<p className="text-white/40 font-medium mb-4">
						You haven't voted on any proposals yet.
					</p>
					<p className="text-xs text-white/30">
						Once you gain governance power, you'll be able to vote on proposals
						that shape the future of LearnVault.
					</p>
				</div>
			)}
		</section>
	)
}
