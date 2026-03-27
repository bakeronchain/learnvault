import React, { useContext, useEffect, useState } from "react"
import { Helmet } from "react-helmet"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { ActivityFeed } from "../components/ActivityFeed"
import AddressDisplay from "../components/AddressDisplay"
import LRNHistoryChart from "../components/LRNHistoryChart"
import { ReputationBadge } from "../components/ReputationBadge"
import {
	NoCredentialsEmptyState,
	ProfileSkeleton,
} from "../components/SkeletonLoader"
import { WalletContext } from "../providers/WalletProvider"
import { shortenAddress } from "../util/scholarshipApplications"

const Profile: React.FC = () => {
	const { t } = useTranslation()
	const { address: walletAddress } = useContext(WalletContext)
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		const timer = setTimeout(() => setIsLoading(false), 2000)
		return () => clearTimeout(timer)
	}, [])

	const user = {
		lrnBalance: "100,000",
		name: walletAddress ? shortenAddress(walletAddress) : "Learner",
		address: walletAddress ?? "",
		nfts: [
			{
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

	const siteUrl = "https://learnvault.app"
	const coursesCompleted = user.nfts.length
	const title = `${user.name} — ${user.lrnBalance} · ${coursesCompleted} Course${coursesCompleted !== 1 ? "s" : ""} — LearnVault`
	const description = `${user.name} has completed ${coursesCompleted} course${coursesCompleted !== 1 ? "s" : ""} and earned ${user.lrnBalance} on LearnVault.`

	if (isLoading) {
		return (
			<div className="p-12 max-w-6xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
				<ProfileSkeleton />
			</div>
		)
	}

	return (
		<div className="p-12 max-w-6xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
			<Helmet>
				<title>{title}</title>
				<meta property="og:title" content={title} />
				<meta property="og:description" content={description} />
				<meta property="og:image" content={`${siteUrl}/og-image.png`} />
				<meta
					property="og:url"
					content={`${siteUrl}/profile/${user.address}`}
				/>
				<meta name="twitter:card" content="summary_large_image" />
			</Helmet>

			<header className="glass-card mb-20 p-12 rounded-[3.5rem] flex flex-col md:flex-row items-center gap-12 relative overflow-hidden group">
				<div className="absolute top-0 right-0 w-64 h-64 bg-brand-cyan/10 blur-[100px] rounded-full -z-10 group-hover:bg-brand-purple/10 transition-colors duration-1000"></div>
				<div className="iridescent-border p-1 rounded-full shadow-2xl shadow-brand-cyan/20">
					<div className="w-32 h-32 bg-[#05070a] rounded-full flex items-center justify-center text-4xl font-black text-gradient">
						AR
					</div>
				</div>
				<div className="flex-1 text-center md:text-left">
					<h1 className="text-4xl font-black mb-3 tracking-tighter">
						{t("pages.profile.title")}
					</h1>
					<div className="mb-6">
						{walletAddress ? (
							<AddressDisplay
								address={walletAddress}
								addressClassName="text-white/30 text-sm tracking-widest"
								buttonClassName="h-6 w-6"
							/>
						) : (
							<code className="text-white/30 text-sm block font-mono tracking-widest">
								{t("wallet.connect")}
							</code>
						)}
					</div>
					<div className="flex flex-wrap justify-center md:justify-start gap-4">
						{walletAddress ? (
							<ReputationBadge size="md" showBalance />
						) : (
							<div className="px-5 py-2 glass rounded-full border border-white/10 text-xs font-black uppercase tracking-widest text-white/40">
								{t("wallet.connect")}
							</div>
						)}
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
					<NoCredentialsEmptyState />
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
						{user.nfts.map((nft, index) => (
							<Link
								to={`/credentials/${nft.id}`}
								key={nft.id}
								aria-label={`Open ${nft.program} credential awarded on ${nft.date}`}
								className="glass-card rounded-[2.5rem] overflow-hidden hover:border-brand-cyan/40 hover:-translate-y-3 transition-all duration-700 group animate-in fade-in zoom-in"
								style={{ animationDelay: `${index * 150}ms` }}
							>
								<div className="relative aspect-square overflow-hidden mb-2">
									<img
										src={nft.artwork}
										alt={`Credential artwork for ${nft.program}`}
										className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 opacity-80 group-hover:opacity-100"
										loading="lazy"
									/>
									<div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
									<div className="absolute bottom-4 left-4 right-4 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-500">
										<span
											className="block w-full py-2 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-xl shadow-xl text-center"
											aria-hidden="true"
										>
											View Certificate
										</span>
									</div>
								</div>
								<div className="p-8">
									<h3 className="text-lg font-black mb-2 leading-tight group-hover:text-brand-cyan transition-colors">
										{nft.program}
									</h3>
									<div className="flex justify-between items-center gap-4">
										<p className="text-[10px] text-white/70 uppercase font-black tracking-widest">
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

			<section className="mt-16">
				<div className="flex items-center gap-4 mb-8">
					<h2 className="text-2xl font-black tracking-tight">LRN History</h2>
					<div className="h-px flex-1 bg-linear-to-r from-white/10 to-transparent" />
				</div>
				<LRNHistoryChart address={walletAddress} />
			</section>

			<ActivityFeed address={walletAddress} limit={10} />
		</div>
	)
}

export default Profile
