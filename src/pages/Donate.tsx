import React from "react"
import { DonateWithAsset } from "../components/donor/DonateWithAsset"
import { useWallet } from "../hooks/useWallet"
import { connectWallet } from "../util/wallet"

const Donate: React.FC = () => {
	const { address } = useWallet()

	if (!address) {
		return (
			<div className="p-8 md:p-12 max-w-6xl mx-auto text-white animate-in fade-in duration-700">
				<header className="text-center mb-16">
					<h1 className="text-4xl sm:text-6xl font-black mb-4 tracking-tighter text-gradient">
						Donate to LearnVault
					</h1>
					<p className="text-white/40 text-lg font-medium max-w-2xl mx-auto">
						Fund scholars with any Stellar asset — XLM, EURC, or any asset with
						DEX liquidity. The treasury receives USDC atomically.
					</p>
				</header>

				<div className="glass-card p-12 rounded-[3rem] border border-brand-cyan/20 text-center mb-16 shadow-2xl">
					<div className="text-6xl mb-6">💰</div>
					<h2 className="text-3xl font-black mb-4">Connect Your Wallet</h2>
					<p className="text-white/40 mb-2 max-w-lg mx-auto">
						Connect your Stellar wallet to donate in any asset and earn
						governance tokens.
					</p>
					<button
						onClick={() => void connectWallet()}
						className="mt-6 rounded-2xl bg-brand-cyan px-8 py-4 font-black uppercase tracking-widest text-black hover:scale-105 active:scale-95 transition-all"
					>
						Connect Wallet
					</button>
				</div>

				{/* Feature cards */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
					{[
						{
							icon: "🔄",
							title: "Path Payments",
							desc: "Donate in XLM or EURC — Stellar's built-in DEX converts to USDC automatically.",
						},
						{
							icon: "🛡️",
							title: "Zero Slippage",
							desc: "The treasury receives the exact USDC amount you specify. No surprises.",
						},
						{
							icon: "🗳️",
							title: "Earn Governance",
							desc: "Your donation earns governance tokens to vote on scholarship proposals.",
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

	return (
		<div className="p-6 md:p-12 max-w-6xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
			<header className="mb-20 relative">
				<div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-brand-cyan/20 blur-[100px] rounded-full -z-10" />
				<div className="mb-8">
					<h1 className="text-4xl sm:text-6xl font-black mb-4 tracking-tighter text-gradient">
						Donate to LearnVault
					</h1>
					<p className="text-white/40 text-lg max-w-2xl font-medium">
						Contribute in any Stellar asset — the treasury receives USDC via
						atomic path payments. You earn governance tokens for every
						contribution.
					</p>
				</div>
			</header>

			<DonateWithAsset />

			<section className="mt-20">
				<h2 className="text-3xl font-black mb-8 text-gradient">How It Works</h2>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
					<div className="glass-card p-8 rounded-[2.5rem] border border-white/5">
						<div className="text-4xl mb-4">1️⃣</div>
						<h3 className="text-lg font-black mb-2">Choose Your Asset</h3>
						<p className="text-white/40 text-sm">
							Select XLM, EURC, or any asset you hold. The system finds the best
							conversion path through Stellar's DEX.
						</p>
					</div>
					<div className="glass-card p-8 rounded-[2.5rem] border border-white/5">
						<div className="text-4xl mb-4">2️⃣</div>
						<h3 className="text-lg font-black mb-2">Review the Quote</h3>
						<p className="text-white/40 text-sm">
							See exactly how much USDC the treasury will receive, the price
							impact, and set your slippage tolerance.
						</p>
					</div>
					<div className="glass-card p-8 rounded-[2.5rem] border border-white/5">
						<div className="text-4xl mb-4">3️⃣</div>
						<h3 className="text-lg font-black mb-2">Sign & Done</h3>
						<p className="text-white/40 text-sm">
							Sign the transaction in your wallet. The path payment converts
							your asset to USDC atomically in one transaction.
						</p>
					</div>
				</div>
			</section>
		</div>
	)
}

export default Donate
