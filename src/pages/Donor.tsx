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
	const { stats, contributions, votes, scholars, isLoading, error } = useDonor()
	const { balance: usdcBalance, isLoading: usdcLoading } = useUSDC(address)
	const [showDepositForm, setShowDepositForm] = useState(false)
	const hasActivity =
		stats.total_contributed > 0n ||
		contributions.length > 0 ||
		votes.length > 0 ||
		scholars.length > 0

	// Guard: Not connected
	if (!address) {
		return (
			<div className="p-8 md:p-12 max-w-6xl mx-auto text-white animate-in fade-in duration-700">
				<header className="text-center mb-16">
					<h1 className="text-6xl font-black mb-4 tracking-tighter text-gradient">
						Donor Dashboard
					</h1>
					<p className="text-white/40 text-lg font-medium max-w-2xl mx-auto">
						Fund scholars, earn governance power, and shape the future of
						decentralized education.
					</p>
				</header>

				{/* Connect prompt */}
				<div className="glass-card p-12 rounded-[3rem] border border-brand-cyan/20 text-center mb-16 shadow-2xl">
					<div className="text-6xl mb-6">🔐</div>
					<h2 className="text-3xl font-black mb-4">Connect Your Wallet</h2>
					<p className="text-white/40 mb-2 max-w-lg mx-auto">
						Connect your Stellar wallet to view your contribution history,
						governance power, and funded scholars.
					</p>
					<p className="text-white/20 text-sm">
						Use the Connect Wallet button in the top-right corner.
					</p>
				</div>

				{/* Feature preview cards */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
					{[
						{
							icon: "💰",
							title: "My Contributions",
							desc: "Track every USDC donation you've made to the scholarship treasury.",
						},
						{
							icon: "🗳️",
							title: "Governance Power",
							desc: "Your LRN tokens grant voting rights on scholarship proposals and DAO decisions.",
						},
						{
							icon: "🎓",
							title: "Scholars Funded",
							desc: "See which scholars you've directly helped fund through the decentralized treasury.",
						},
					].map(({ icon, title, desc }) => (
						<div
							key={title}
							className="glass-card p-8 rounded-[2.5rem] border border-white/5 opacity-60"
						>
							<div className="text-3xl mb-4">{icon}</div>
							<h3 className="text-lg font-black mb-2">{title}</h3>
							<p className="text-white/40 text-sm leading-relaxed">{desc}</p>
						</div>
					))}
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
						value={`$${(Number(stats.total_contributed) / 1e7).toLocaleString()}`}
						icon="💰"
						color="text-brand-cyan"
					/>
					<StatCard
						label="Votes Cast"
						value={stats.votes_cast.toString()}
						icon="🗳️"
						color="text-brand-purple"
					/>
					<StatCard
						label="Scholars Funded"
						value={stats.scholars_funded.toString()}
						icon="🎓"
						color="text-brand-blue"
					/>
				</div>
			</header>

			{/* Main Content */}
			<div className="space-y-20">
				<MyContributions
					contributions={contributions}
					totalContributed={Number(stats.total_contributed) / 1e7}
				/>

				<GovernancePower balance={stats.votes_cast} percentage={0} />

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
