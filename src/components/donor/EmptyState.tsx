import React from "react"

interface EmptyStateProps {
	onBecomeDonor: () => void
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onBecomeDonor }) => {
	return (
		<div className="min-h-screen flex items-center justify-center p-12">
			<div className="text-center max-w-2xl">
				<div className="mb-12">
					<div className="inline-block mb-8">
						<div className="text-7xl animate-bounce">💚</div>
					</div>
					<h1 className="text-5xl font-black mb-4 text-gradient">
						Support Education, Earn Governance
					</h1>
					<p className="text-white/40 text-xl font-medium leading-relaxed">
						Join the LearnVault donor community. Your contributions fund
						scholarship proposals and earn you governance tokens to shape the
						future of decentralized education.
					</p>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
					<div className="glass-card p-8 rounded-[2.5rem] border border-white/5">
						<div className="text-4xl mb-4">🎓</div>
						<h3 className="font-black mb-2 text-lg">Fund Scholars</h3>
						<p className="text-white/40 text-sm font-medium">
							Support approved scholarship proposals that change lives
						</p>
					</div>
					<div className="glass-card p-8 rounded-[2.5rem] border border-white/5">
						<div className="text-4xl mb-4">🗳️</div>
						<h3 className="font-black mb-2 text-lg">Earn Voting Power</h3>
						<p className="text-white/40 text-sm font-medium">
							Get governance tokens and vote on DAO decisions
						</p>
					</div>
					<div className="glass-card p-8 rounded-[2.5rem] border border-white/5">
						<div className="text-4xl mb-4">✓</div>
						<h3 className="font-black mb-2 text-lg">Track Impact</h3>
						<p className="text-white/40 text-sm font-medium">
							See real-time progress of scholars you funded
						</p>
					</div>
				</div>

				<div className="glass-card p-12 rounded-[3rem] border border-white/5 mb-12 bg-brand-cyan/5 border-brand-cyan/20">
					<h2 className="text-2xl font-black mb-6">How It Works</h2>
					<div className="space-y-4 text-left">
						<div className="flex gap-4">
							<div className="w-12 h-12 flex-shrink-0 rounded-full bg-brand-cyan/20 border border-brand-cyan/40 flex items-center justify-center font-black text-brand-cyan">
								1
							</div>
							<div>
								<h4 className="font-black mb-2">Deposit USDC</h4>
								<p className="text-white/40 font-medium">
									Use your wallet to deposit USDC to the scholarship treasury
								</p>
							</div>
						</div>
						<div className="flex gap-4">
							<div className="w-12 h-12 flex-shrink-0 rounded-full bg-brand-cyan/20 border border-brand-cyan/40 flex items-center justify-center font-black text-brand-cyan">
								2
							</div>
							<div>
								<h4 className="font-black mb-2">Receive Governance Tokens</h4>
								<p className="text-white/40 font-medium">
									1 USDC = 1 GOV token for voting and impact tracking
								</p>
							</div>
						</div>
						<div className="flex gap-4">
							<div className="w-12 h-12 flex-shrink-0 rounded-full bg-brand-cyan/20 border border-brand-cyan/40 flex items-center justify-center font-black text-brand-cyan">
								3
							</div>
							<div>
								<h4 className="font-black mb-2">Vote & Track Impact</h4>
								<p className="text-white/40 font-medium">
									Vote on proposals and watch your funded scholars succeed
								</p>
							</div>
						</div>
					</div>
				</div>

				<button
					onClick={onBecomeDonor}
					className="px-12 py-4 bg-brand-cyan text-black font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-brand-cyan/40 hover:scale-105 hover:shadow-[0_0_30px_rgba(0,210,255,0.5)] transition-all active:scale-95"
				>
					Become a Donor →
				</button>

				<p className="text-xs text-white/30 mt-8">
					🔐 Your deposits are secured on the Stellar blockchain
				</p>
			</div>
		</div>
	)
}
