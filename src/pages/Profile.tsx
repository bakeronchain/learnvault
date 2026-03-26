import React, { useContext, useEffect, useState } from "react"
import { Helmet } from "react-helmet"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { ActivityFeed } from "../components/ActivityFeed"
import { CourseProgressBar } from "../components/CourseProgressBar"
import { ReputationBadge } from "../components/ReputationBadge"
import {
	NoCredentialsEmptyState,
	ProfileSkeleton,
} from "../components/SkeletonLoader"
import TxHashLink from "../components/TxHashLink"
import { useCourse } from "../hooks/useCourse"
import { WalletContext } from "../providers/WalletProvider"
import { shortenAddress } from "../util/scholarshipApplications"

const Profile: React.FC = () => {
	const { t } = useTranslation()
	const { address: walletAddress } = useContext(WalletContext)
	const [isLoading, setIsLoading] = useState(true)
	const { getCourseProgress } = useCourse()

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
				id: "soroban-101",
				program: "Soroban 101",
				date: "2024-02-15",
				artwork: "https://api.placeholder.com/150/150?text=S101",
				txHash:
					"4abf553f8be9368e4bfef9a9a5d8baa8354b178f90af77e523bc93c28c12d8fb",
				totalMilestones: 8,
			},
			{
				id: "smart-contract-masterclass",
				program: "Smart Contract Masterclass",
				date: "2024-03-20",
				artwork: "https://api.placeholder.com/150/150?text=SCM",
				txHash:
					"8e1df4f2efef3f4a39d24802f91b0f2a68501259b6bdca6354ec4f15d6a3bb27",
				totalMilestones: 8,
			},
		],
		history: [
			{
				id: "mint-1",
				action: "Credential minted",
				date: "2024-03-20",
				txHash:
					"2f54a54d8071f1482c33495e0ab162bb3c689f86492a56dfcd13fdb7e48ae6d2",
			},
			{
				id: "reward-1",
				action: "Reputation reward settled",
				date: "2024-03-21",
				txHash:
					"54ef8fa89e823e95fd6f56df5907353c6fc5c5f7b50aa8b2ca18c8953d607c42",
				totalMilestones: 12,
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
					<code className="text-white/30 text-sm block mb-6 font-mono tracking-widest">
						{walletAddress
							? shortenAddress(walletAddress)
							: t("wallet.connect")}
					</code>
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
						{user.nfts.map((nft, index) => {
							const progress = getCourseProgress(nft.id)
							const completedCount = progress.completedMilestoneIds.length

							return (
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
										<div className="flex justify-between items-center gap-4 mb-4">
											<p className="text-[10px] text-white/70 uppercase font-black tracking-widest">
												{nft.date}
											</p>
											<span className="text-[10px] text-brand-emerald font-black uppercase tracking-widest">
												Verified ✓
											</span>
										</div>

										{/* ── Progress bar ── */}
										<CourseProgressBar
											completed={completedCount}
											total={nft.totalMilestones}
											size="sm"
											animate
										/>
									</div>
								</Link>
							)
						})}
					</div>
				)}
			</section>

			<section className="mt-20">
				<div className="flex items-center gap-4 mb-12">
					<h2 className="text-2xl font-black tracking-tight">
						Profile History
					</h2>
					<div className="h-px flex-1 bg-linear-to-r from-white/10 to-transparent" />
				</div>
				<div className="glass-card rounded-[2.5rem] p-8 flex flex-col gap-5">
					{user.history.map((entry) => (
						<div
							key={entry.id}
							className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-2xl border border-white/5 bg-white/5 px-6 py-5"
						>
							<div>
								<p className="font-bold">{entry.action}</p>
								<p className="text-[10px] text-white/30 uppercase font-black tracking-widest mt-1">
									{entry.date}
								</p>
							</div>
							<TxHashLink
								hash={entry.txHash}
								className="inline-flex text-[10px] font-black uppercase tracking-widest text-brand-cyan hover:underline"
							/>
						</div>
					))}
				</div>
			</section>
		</div>
	)
}

export default Profile
