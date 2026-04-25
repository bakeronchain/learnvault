import React, { useCallback, useContext, useEffect, useState } from "react"
import { Helmet } from "react-helmet"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import { ActivityFeed } from "../components/ActivityFeed"
import AddressDisplay from "../components/AddressDisplay"
import { FollowButton } from "../components/FollowButton"
import LRNHistoryChart from "../components/LRNHistoryChart"
import { ReputationBadge } from "../components/ReputationBadge"
import {
	NoCredentialsEmptyState,
	ProfileSkeleton,
} from "../components/SkeletonLoader"
import { ErrorState } from "../components/states/errorState"
import { useScholarCredentials } from "../hooks/useScholarCredentials"
import { useScholarProfile } from "../hooks/useScholarProfile"
import { WalletContext } from "../providers/WalletProvider"
import { formatDuration, getLearningTimeSummary } from "../util/learningTime"
import { shortenAddress } from "../util/scholarshipApplications"

type UserNft = {
	id: string
	course_id?: string
	program: string
	date: string
	artwork?: string
}

const Profile: React.FC = () => {
	const { t } = useTranslation()
	const { walletAddress: paramAddress } = useParams<{ walletAddress: string }>()
	const { address: contextAddress } = useContext(WalletContext)

	const displayAddress = paramAddress || contextAddress
	const isOwnProfile = !paramAddress || paramAddress === contextAddress

	const {
		data: profile,
		isLoading: isProfileLoading,
		error: profileError,
	} = useScholarProfile(displayAddress)

	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [nfts, setNfts] = useState<UserNft[]>([])
	const [learningTimeLabel, setLearningTimeLabel] = useState("0m")

	const fetchCredentials = useCallback(async () => {
		if (!displayAddress) {
			setNfts([])
			setIsLoading(false)
			return
		}

		try {
			setIsLoading(true)
			setError(null)

			const response = await fetch(`/api/credentials/${displayAddress}`, {
				method: "GET",
			})

			if (!response.ok) {
				const payload = await response.json().catch(() => ({}))
				throw new Error(
					payload.message || payload.error || "Unable to load credentials",
				)
			}

			const data = await response.json()
			setNfts(
				Array.isArray(data.data)
					? data.data.map((item: any) => ({
							id: String(item.token_id ?? item.course_id ?? Math.random()),
							course_id: item.course_id,
							program: item.course_id ?? "Unknown course",
							date: item.minted_at
								? new Date(item.minted_at).toLocaleDateString()
								: "Unknown",
							artwork: item.metadata_uri
								? `https://gateway.pinata.cloud/ipfs/${item.metadata_uri.replace("ipfs://", "")}`
								: undefined,
						}))
					: [],
			)
		} catch (err) {
			console.error("[profile] error loading credentials", err)
			setError(
				err instanceof Error ? err.message : "Failed to load credentials",
			)
		} finally {
			setIsLoading(false)
		}
	}, [walletAddress])

	useEffect(() => {
		void fetchCredentials()
	}, [fetchCredentials])

	useEffect(() => {
		const summary = getLearningTimeSummary()
		setLearningTimeLabel(formatDuration(summary.totalSeconds))
	}, [])

	const siteUrl = "https://learnvault.app"
	const userName = displayAddress ? shortenAddress(displayAddress) : "Learner"
	const lrnBalance = profile?.lrn_balance || "0"
	const coursesCompleted = nfts.length
	const title = `${userName} — ${lrnBalance} · ${coursesCompleted} Course${
		coursesCompleted !== 1 ? "s" : ""
	} — LearnVault`
	const description = `${userName} has completed ${coursesCompleted} course${
		coursesCompleted !== 1 ? "s" : ""
	} and earned ${lrnBalance} on LearnVault.`

	if (isProfileLoading || isLoading) {
		return (
			<div className="p-12 max-w-6xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
				<ProfileSkeleton />
			</div>
		)
	}

	if (profileError || error) {
		return (
			<div className="p-12 max-w-6xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
				<ErrorState
					message={(profileError as any)?.message || error}
					onRetry={fetchCredentials}
				/>
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
					content={`${siteUrl}/profile/${displayAddress ?? ""}`}
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
					<div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-6">
						{displayAddress ? (
							<div className="flex items-center gap-6">
								<AddressDisplay
									address={displayAddress}
									addressClassName="text-white/30 text-sm tracking-widest"
									buttonClassName="h-6 w-6"
								/>
								{!isOwnProfile && (
									<FollowButton
										targetAddress={displayAddress}
										isFollowingInitial={profile?.is_following}
									/>
								)}
							</div>
						) : (
							<code className="text-white/30 text-sm block font-mono tracking-widest">
								{t("wallet.connect")}
							</code>
						)}
					</div>
					<div className="flex flex-wrap justify-center md:justify-start gap-6">
						<div className="flex gap-4">
							<div className="text-center md:text-left">
								<div className="text-xl font-black text-white">
									{profile?.follower_count || 0}
								</div>
								<div className="text-[10px] uppercase font-black tracking-widest text-white/30">
									Followers
								</div>
							</div>
							<div className="text-center md:text-left">
								<div className="text-xl font-black text-white">
									{profile?.following_count || 0}
								</div>
								<div className="text-[10px] uppercase font-black tracking-widest text-white/30">
									Following
								</div>
							</div>
						</div>
						<div className="w-px h-10 bg-white/10 hidden md:block" />
						{displayAddress ? (
							<ReputationBadge size="md" showBalance />
						) : (
							<div className="px-5 py-2 glass rounded-full border border-white/10 text-xs font-black uppercase tracking-widest text-white/40">
								{t("wallet.connect")}
							</div>
						)}
						<div className="px-5 py-2 glass rounded-full border border-white/10 text-xs font-black uppercase tracking-widest text-brand-cyan">
							Learning Time: {learningTimeLabel}
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

				{nfts.length === 0 ? (
					<NoCredentialsEmptyState />
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
						{nfts.map((nft, index) => (
							<div
								key={nft.id}
								className="glass-card rounded-[2.5rem] overflow-hidden hover:border-brand-cyan/40 hover:-translate-y-3 transition-all duration-700 group animate-in fade-in zoom-in"
								style={{ animationDelay: `${index * 150}ms` }}
							>
								<div className="relative aspect-square overflow-hidden mb-2">
									{nft.artwork ? (
										<img
											src={nft.artwork}
											alt={`Credential artwork for ${nft.program}`}
											className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 opacity-80 group-hover:opacity-100"
											loading="lazy"
										/>
									) : (
										<div className="w-full h-full bg-gradient-to-br from-brand-cyan/20 to-brand-purple/20 flex items-center justify-center">
											<span className="text-4xl font-black text-white/40">
												{nft.program?.charAt(0) ?? "?"}
											</span>
										</div>
									)}
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
							</div>
						))}
					</div>
				)}
			</section>

			<section className="mt-16">
				<div className="flex items-center gap-4 mb-8">
					<h2 className="text-2xl font-black tracking-tight">LRN History</h2>
					<div className="h-px flex-1 bg-linear-to-r from-white/10 to-transparent" />
				</div>
				<LRNHistoryChart address={displayAddress} />
			</section>

			<ActivityFeed address={displayAddress} limit={10} />
		</div>
	)
}

export default Profile
