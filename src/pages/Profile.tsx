/**
 * pages/Profile.tsx
 *
 * Issue #44 — Add skeleton loading screens and empty state components
 * bakeronchain/learnvault
 *
 * Added: ProfileSkeleton and NoCredentialsEmptyState
 */

import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import {
	ProfileSkeleton,
	NoCredentialsEmptyState,
} from "../components/SkeletonLoader"

const Profile: React.FC = () => {
	const { t } = useTranslation()
	const [isLoading, setIsLoading] = useState(true)

	// Issue #44 — Simulate async data fetch for skeleton demo
	useEffect(() => {
		const timer = setTimeout(() => setIsLoading(false), 2000)
		return () => clearTimeout(timer)
	}, [])

	const user = {
		name: "Alex Rivera",
		address: "GA7B...4Y2K",
		lrnBalance: "250 LRN",
		nfts: [
			{
				id: "1",
				program: "Soroban 101",
				date: "2024-02-15",
				artwork: "https://api.placeholder.com/150/150?text=S101",
			},
			{
				id: "2",
				program: "Smart Contract Masterclass",
				date: "2024-03-20",
				artwork: "https://api.placeholder.com/150/150?text=SCM",
			},
		],
	}

	if (isLoading) {
		// Issue #44 — Profile skeleton
		return (
			<div className="p-12 max-w-6xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
				<ProfileSkeleton />
			</div>
		)
	}

	return (
		<div className="p-12 max-w-6xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
			<header className="glass-card mb-20 p-12 rounded-[3.5rem] flex flex-col md:flex-row items-center gap-12 relative overflow-hidden group">
				<div className="absolute top-0 right-0 w-64 h-64 bg-brand-cyan/10 blur-[100px] rounded-full -z-10 group-hover:bg-brand-purple/10 transition-colors duration-1000" />
				<div className="iridescent-border p-1 rounded-full shadow-2xl shadow-brand-cyan/20">
					<div className="w-32 h-32 bg-[#05070a] rounded-full flex items-center justify-center text-4xl font-black text-gradient">
						AR
					</div>
				</div>
				<div className="flex-1 text-center md:text-left">
					<h1 className="text-4xl font-black mb-3 tracking-tighter">
						{t("pages.profile.title")}
					</h1>
					<code className="text-white/30 text-sm block mb-6 font-mono tracking-widest">
						{user.address}
					</code>
					<div className="flex flex-wrap justify-center md:justify-start gap-4">
						<div className="px-5 py-2 glass rounded-full border border-brand-cyan/30 flex items-center gap-2">
							<span className="w-2 h-2 bg-brand-cyan rounded-full animate-pulse" />
							<span className="text-xs font-black uppercase tracking-widest text-brand-cyan">
								{user.lrnBalance}
							</span>
						</div>
						<div className="px-5 py-2 glass rounded-full border border-white/10 text-xs font-black uppercase tracking-widest text-white/40">
							Elite Scholar Tier
						</div>
					</div>
				</div>
			</header>

			<section>
				<div className="flex items-center gap-4 mb-12">
					<h2 className="text-2xl font-black tracking-tight">
						{t("pages.profile.desc")}
					</h2>
					<div className="h-px flex-1 bg-linear-to-r from-white/10 to-transparent" />
				</div>

				{user.nfts.length === 0 ? (
					// Issue #44 — No credentials empty state
					<NoCredentialsEmptyState />
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
						{user.nfts.map((nft, index) => (
							<Link
								to={`/credentials/${nft.id}`}
								key={nft.id}
								className="glass-card rounded-[2.5rem] overflow-hidden hover:border-brand-cyan/40 hover:-translate-y-3 transition-all duration-500 group animate-in fade-in zoom-in duration-700"
								style={{ animationDelay: `${index * 150}ms` }}
							>
								<div className="relative aspect-square overflow-hidden mb-2">
									<img
										src={nft.artwork}
										alt={nft.program}
										className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 opacity-80 group-hover:opacity-100"
									/>
									<div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
									<div className="absolute bottom-4 left-4 right-4 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-500">
										<button className="w-full py-2 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-xl shadow-xl">
											View Certificate
										</button>
									</div>
								</div>
								<div className="p-8">
									<h3 className="text-lg font-black mb-2 leading-tight group-hover:text-brand-cyan transition-colors">
										{nft.program}
									</h3>
									<div className="flex justify-between items-center">
										<p className="text-[10px] text-white/30 uppercase font-black tracking-widest">
											{nft.date}
										</p>
										<span className="text-[10px] text-brand-emerald font-black uppercase tracking-widest">
											Verified ✓
										</span>
									</div>
								</div>
							</Link>
						))}
					</div>
				)}
			</section>
		</div>
	)
}

export default Profile
