import React, { useState } from "react"
import { ActiveVotes } from "../components/donor/ActiveVotes"
import { DepositMore } from "../components/donor/DepositMore"
import { EmptyState } from "../components/donor/EmptyState"
import { GovernancePower } from "../components/donor/GovernancePower"
import { MyContributions } from "../components/donor/MyContributions"
import { ScholarsFunded } from "../components/donor/ScholarsFunded"
import { useDonor } from "../hooks/useDonor"
import { useUSDC } from "../hooks/useUSDC"
import { useWallet } from "../hooks/useWallet"

const Donor: React.FC = () => {
	const { address } = useWallet()
	const { stats, contributions, votes, scholars, isLoading, error, isEmpty } =
		useDonor()
	const { balance: usdcBalance, isLoading: usdcLoading } = useUSDC(address)
	const [showDepositForm, setShowDepositForm] = useState(false)
	const hasActivity =
		stats.totalContributed > 0 ||
		stats.governanceBalance > 0 ||
		contributions.length > 0 ||
		votes.length > 0 ||
		scholars.length > 0

	// Guard: Not connected
	if (!address) {
		return (
			<div className="min-h-screen p-12 text-white animate-in fade-in">
				<div className="max-w-6xl mx-auto">
					<div className="text-center py-20">
						<div className="text-6xl mb-6">🔓</div>
						<h1 className="text-4xl font-black mb-4">
							Wallet Connection Required
						</h1>
						<p className="text-white/40 text-lg font-medium mb-8">
							Please connect your wallet to access the donor dashboard.
						</p>
						<p className="text-white/30 text-sm">
							The donor dashboard connects to your wallet to display
							contributions, governance power, and funded scholars.
						</p>
					</div>
				</div>
			</div>
		)
	}

	// Loading state
	if (isLoading) {
		return (
			<div className="min-h-screen p-12 text-white flex items-center justify-center">
				<div className="text-center">
					<div className="text-4xl mb-4 animate-spin">⚙️</div>
					<p className="text-white/40">Loading donor dashboard...</p>
				</div>
			</div>
		)
	}

	// Error state
	if (error) {
		return (
			<div className="min-h-screen p-12 text-white">
				<div className="max-w-6xl mx-auto">
					<div className="glass-card p-12 rounded-[3rem] border border-white/5 text-center">
						<div className="text-4xl mb-4">⚠️</div>
						<h2 className="text-2xl font-black mb-2">Unable to Load Data</h2>
						<p className="text-white/40">{error}</p>
					</div>
				</div>
			</div>
		)
	}

	// Empty state: No contributions yet
	if (!hasActivity && !showDepositForm) {
		return <EmptyState onBecomeDonor={() => setShowDepositForm(true)} />
	}

	return (
		<div className="p-12 max-w-6xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
			{/* Header */}
			<header className="mb-20 relative">
				<div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-brand-cyan/20 blur-[100px] rounded-full -z-10" />
				<div className="mb-8">
					<h1 className="text-6xl font-black mb-4 tracking-tighter text-gradient">
						Donor Dashboard
					</h1>
					<p className="text-white/40 text-lg max-w-2xl font-medium">
						Track your contributions, governance power, and the impact of your
						funded scholars.
					</p>
				</div>

				{/* Stats Overview */}
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
					<StatCard
						label="USDC Balance"
						value={
							usdcLoading
								? "…"
								: usdcBalance !== undefined
									? `$${usdcBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
									: "—"
						}
						icon="💵"
						color="text-brand-cyan"
					/>
					<StatCard
						label="Total Contributed"
						value={`$${stats.totalContributed.toLocaleString()}`}
						icon="💰"
						color="text-brand-cyan"
					/>
					<StatCard
						label="Governance Tokens"
						value={stats.governanceBalance.toLocaleString()}
						icon="🗳️"
						color="text-brand-purple"
					/>
					<StatCard
						label="Proposals Voted"
						value={stats.proposalsVoted.toString()}
						icon="✓"
						color="text-brand-emerald"
					/>
					<StatCard
						label="Scholars Funded"
						value={stats.scholarsFunded.toString()}
						icon="🎓"
						color="text-brand-blue"
					/>
				</div>
			</header>

			{/* Main Content */}
			<div className="space-y-20">
				<MyContributions
					contributions={contributions}
					totalContributed={stats.totalContributed}
				/>

				<GovernancePower
					balance={stats.governanceBalance}
					percentage={stats.governancePercentage}
				/>

				<ActiveVotes votes={votes} />

				<ScholarsFunded scholars={scholars} />

				<DepositMore onDepositSuccess={() => setShowDepositForm(false)} />
			</div>
		</div>
	)
}

interface StatCardProps {
	label: string
	value: string
	icon: string
	color: string
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color }) => {
	return (
		<div className="glass-card p-6 rounded-2xl border border-white/5 group hover:border-white/20 transition-all">
			<p className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-3">
				{label}
			</p>
			<div className="flex items-baseline gap-2">
				<span className={`text-2xl font-black ${color}`}>{icon}</span>
				<p className="text-xl font-black line-clamp-1">{value}</p>
			</div>
		</div>
	)
}

export default Donor
