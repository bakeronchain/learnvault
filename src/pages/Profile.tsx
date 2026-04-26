import React, { useCallback, useContext, useEffect, useState } from "react"
import { Helmet } from "react-helmet"
import { useTranslation } from "react-i18next"
import { ActivityFeed } from "../components/ActivityFeed"
import AddressDisplay from "../components/AddressDisplay"
import IdenticonAvatar from "../components/IdenticonAvatar"
import LRNHistoryChart from "../components/LRNHistoryChart"
import ProfileEditForm, {
	type ProfileFormData,
} from "../components/ProfileEditForm"
import { ProfileLinkedWallets } from "../components/ProfileLinkedWallets"
import { ReputationBadge } from "../components/ReputationBadge"
import {
	NoCredentialsEmptyState,
	ProfileSkeleton,
} from "../components/SkeletonLoader"
import { ErrorState } from "../components/states/errorState"
import { useLearnerProfile } from "../hooks/useLearnerProfile"
import { WalletContext } from "../providers/WalletProvider"
import { formatDuration, getLearningTimeSummary } from "../util/learningTime"
import { shortenAddress } from "../util/scholarshipApplications"

interface UserProfile {
	id: string
	stellarAddress: string
	displayName: string | null
	bio: string | null
	avatarUrl: string | null
	avatarCid: string | null
	socialLinks: {
		twitter?: string
		github?: string
		linkedin?: string
		website?: string
		discord?: string
	}
	reputationRank: number | null
	createdAt: string
	updatedAt: string
}

interface ProfileStats {
	lrnBalance: number
	coursesCompleted: number
	reputationRank: number | null
	percentile: number
}

type UserNft = {
	id: string
	course_id?: string
	program: string
	date: string
	artwork?: string
}

const Profile: React.FC = () => {
	const { t } = useTranslation()
	const { address: walletAddress } = useContext(WalletContext)
	const { profile } = useLearnerProfile()
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [nfts, setNfts] = useState<UserNft[]>([])
	const [learningTimeLabel, setLearningTimeLabel] = useState("0m")
	const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
	const [stats, setStats] = useState<ProfileStats | null>(null)
	const [isEditing, setIsEditing] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [viewAddress, setViewAddress] = useState<string | null>(null)

	const fetchCredentials = useCallback(async () => {
		if (!walletAddress) {
			setNfts([])
			setIsLoading(false)
			return
		}

		const addresses =
			profile?.wallets && profile.wallets.length > 0
				? profile.wallets.map((w) => w.address)
				: [walletAddress]

		try {
			setIsLoading(true)
			setError(null)

			const responses = await Promise.all(
				addresses.map((addr) =>
					fetch(`/api/credentials/${addr}`, { method: "GET" }),
				),
			)
			for (const response of responses) {
				if (!response.ok) {
					const payload = await response.json().catch(() => ({}))
					throw new Error(
						payload.message || payload.error || "Unable to load credentials",
					)
				}
			}
			const payloads = await Promise.all(
				responses.map((r) => r.json() as Promise<{ data?: unknown[] }>),
			)
			const byId = new Map<string, UserNft>()
			for (const data of payloads) {
				if (!Array.isArray(data.data)) continue
				for (const item of data.data) {
					const anyItem = item as any
					const id = String(
						anyItem.token_id ?? anyItem.course_id ?? crypto.randomUUID(),
					)
					if (byId.has(id)) continue
					byId.set(id, {
						id,
						course_id: anyItem.course_id,
						program: anyItem.course_id ?? "Unknown course",
						date: anyItem.minted_at
							? new Date(anyItem.minted_at).toLocaleDateString()
							: "Unknown",
						artwork: anyItem.metadata_uri
							? `https://gateway.pinata.cloud/ipfs/${String(
									anyItem.metadata_uri,
								).replace("ipfs://", "")}`
							: undefined,
					})
				}
			}
			setNfts([...byId.values()])
		} catch (err) {
			console.error("[profile] error loading credentials", err)
			setError(
				err instanceof Error ? err.message : "Failed to load credentials",
			)
		} finally {
			setIsLoading(false)
		}
	}, [walletAddress, profile])

	// Determine which address to view (from URL param or connected wallet)
	useEffect(() => {
		const pathMatch = window.location.pathname.match(/\/profile\/(.+)/)
		if (pathMatch?.[1]) {
			setViewAddress(pathMatch[1])
		} else if (walletAddress) {
			setViewAddress(walletAddress)
		}
	}, [walletAddress])

	// Fetch rich profile data
	const fetchProfileData = useCallback(async () => {
		if (!viewAddress) return

		try {
			const response = await fetch(`/api/profile/${viewAddress}`)
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}))
				throw new Error(errorData.error || "Failed to load profile")
			}
			const data = await response.json()
			setUserProfile(data.profile)
			setStats(data.stats)
		} catch (err) {
			console.error("[profile] Error loading profile data:", err)
		}
	}, [viewAddress])

	useEffect(() => {
		void fetchProfileData()
	}, [fetchProfileData])

	useEffect(() => {
		void fetchCredentials()
	}, [fetchCredentials])

	useEffect(() => {
		const summary = getLearningTimeSummary()
		setLearningTimeLabel(formatDuration(summary.totalSeconds))
	}, [])

	const handleSaveProfile = useCallback(
		async (formData: ProfileFormData) => {
			if (!walletAddress) return

			setIsSaving(true)
			try {
				const authToken = localStorage.getItem("authToken") || ""
				const response = await fetch("/api/profile", {
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${authToken}`,
					},
					body: JSON.stringify({
						displayName: formData.displayName || null,
						bio: formData.bio || null,
						avatarUrl: formData.avatarUrl,
						avatarCid: formData.avatarCid,
						socialLinks: formData.socialLinks,
					}),
				})

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({}))
					throw new Error(errorData.error || "Failed to save profile")
				}

				const data = await response.json()
				setUserProfile(data.profile)
				setIsEditing(false)
			} catch (err) {
				console.error("[profile] Error saving profile:", err)
				throw err
			} finally {
				setIsSaving(false)
			}
		},
		[walletAddress],
	)

	const isOwnProfile = walletAddress === viewAddress
	const displayName =
		userProfile?.displayName ||
		(viewAddress ? shortenAddress(viewAddress) : "Learner")
	const bio = userProfile?.bio || ""
	const hasSocialLinks =
		userProfile?.socialLinks &&
		Object.values(userProfile.socialLinks).some(Boolean)

	const siteUrl = "https://learnvault.app"
	const lrnBalance = stats?.lrnBalance.toLocaleString() ?? "0"
	const coursesCompleted = stats?.coursesCompleted ?? nfts.length
	const title = `${displayName} — ${lrnBalance} LRN · ${coursesCompleted} Course${
		coursesCompleted !== 1 ? "s" : ""
	} — LearnVault`
	const description =
		bio ||
		`${displayName} has completed ${coursesCompleted} course${
			coursesCompleted !== 1 ? "s" : ""
		} and earned ${lrnBalance} LRN on LearnVault.`

	if (isLoading) {
		return (
			<div className="p-12 max-w-6xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
				<ProfileSkeleton />
			</div>
		)
	}

	if (error) {
		return (
			<div className="p-12 max-w-6xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
				<ErrorState message={error} onRetry={fetchCredentials} />
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
					content={`${siteUrl}/profile/${walletAddress ?? ""}`}
				/>
				<meta name="twitter:card" content="summary_large_image" />
			</Helmet>

			<header className="glass-card mb-20 p-12 rounded-[3.5rem] flex flex-col md:flex-row items-center gap-12 relative overflow-hidden group">
				<div className="absolute top-0 right-0 w-64 h-64 bg-brand-cyan/10 blur-[100px] rounded-full -z-10 group-hover:bg-brand-purple/10 transition-colors duration-1000"></div>
				<div className="iridescent-border p-1 rounded-full shadow-2xl shadow-brand-cyan/20">
					{userProfile?.avatarUrl ? (
						<img
							src={userProfile.avatarUrl}
							alt={`${displayName}'s avatar`}
							className="w-32 h-32 rounded-full object-cover"
						/>
					) : viewAddress ? (
						<IdenticonAvatar address={viewAddress} size={128} />
					) : (
						<div className="w-32 h-32 bg-[#05070a] rounded-full flex items-center justify-center text-4xl font-black text-gradient">
							{displayName.slice(0, 2).toUpperCase()}
						</div>
					)}
				</div>
				<div className="flex-1 text-center md:text-left">
					<h1 className="text-4xl font-black mb-3 tracking-tighter">
						{displayName}
					</h1>
					{bio && (
						<p className="text-white/70 mb-4 max-w-lg mx-auto md:mx-0 line-clamp-3">
							{bio}
						</p>
					)}
					<div className="mb-6">
						{viewAddress ? (
							<AddressDisplay
								address={viewAddress}
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
						{viewAddress ? (
							<ReputationBadge size="md" showBalance />
						) : (
							<div className="px-5 py-2 glass rounded-full border border-white/10 text-xs font-black uppercase tracking-widest text-white/40">
								{t("wallet.connect")}
							</div>
						)}
						<div className="px-5 py-2 glass rounded-full border border-white/10 text-xs font-black uppercase tracking-widest text-brand-cyan">
							Learning Time: {learningTimeLabel}
						</div>
						{stats?.reputationRank && (
							<div className="px-5 py-2 glass rounded-full border border-white/10 text-xs font-black uppercase tracking-widest text-brand-purple">
								Rank #{stats.reputationRank}
							</div>
						)}
						{stats?.percentile && (
							<div className="px-5 py-2 glass rounded-full border border-white/10 text-xs font-black uppercase tracking-widest text-brand-emerald">
								Top {stats.percentile}%
							</div>
						)}
					</div>

					{/* Social Links */}
					{hasSocialLinks && (
						<div className="flex flex-wrap justify-center md:justify-start gap-3 mt-4">
							{userProfile.socialLinks.twitter && (
								<a
									href={
										userProfile.socialLinks.twitter.startsWith("http")
											? userProfile.socialLinks.twitter
											: `https://twitter.com/${userProfile.socialLinks.twitter}`
									}
									target="_blank"
									rel="noopener noreferrer"
									className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
								>
									Twitter
								</a>
							)}
							{userProfile.socialLinks.github && (
								<a
									href={
										userProfile.socialLinks.github.startsWith("http")
											? userProfile.socialLinks.github
											: `https://github.com/${userProfile.socialLinks.github}`
									}
									target="_blank"
									rel="noopener noreferrer"
									className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
								>
									GitHub
								</a>
							)}
							{userProfile.socialLinks.linkedin && (
								<a
									href={
										userProfile.socialLinks.linkedin.startsWith("http")
											? userProfile.socialLinks.linkedin
											: `https://linkedin.com/in/${userProfile.socialLinks.linkedin}`
									}
									target="_blank"
									rel="noopener noreferrer"
									className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
								>
									LinkedIn
								</a>
							)}
							{userProfile.socialLinks.website && (
								<a
									href={
										userProfile.socialLinks.website.startsWith("http")
											? userProfile.socialLinks.website
											: `https://${userProfile.socialLinks.website}`
									}
									target="_blank"
									rel="noopener noreferrer"
									className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
								>
									Website
								</a>
							)}
						</div>
					)}

					{/* Edit Profile Button (only for own profile) */}
					{isOwnProfile && !isEditing && (
						<button
							onClick={() => setIsEditing(true)}
							className="mt-4 px-4 py-2 rounded-lg border border-brand-cyan/30 bg-brand-cyan/10 text-sm font-medium text-brand-cyan hover:bg-brand-cyan/20 transition-colors"
						>
							Edit Profile
						</button>
					)}
				</div>
			</header>

			{/* Edit Profile Form */}
			{isEditing && isOwnProfile && (
				<section className="glass-card mb-12 p-8 rounded-3xl border border-brand-cyan/20">
					<div className="flex items-center gap-4 mb-6">
						<h2 className="text-2xl font-black tracking-tight">Edit Profile</h2>
						<div className="h-px flex-1 bg-linear-to-r from-brand-cyan/20 to-transparent" />
					</div>
					<ProfileEditForm
						walletAddress={walletAddress || ""}
						authToken={localStorage.getItem("authToken") || ""}
						initialData={{
							displayName: userProfile?.displayName ?? "",
							bio: userProfile?.bio ?? "",
							avatarUrl: userProfile?.avatarUrl,
							avatarCid: userProfile?.avatarCid,
							socialLinks: userProfile?.socialLinks ?? {},
						}}
						onSave={handleSaveProfile}
						onCancel={() => setIsEditing(false)}
						isLoading={isSaving}
					/>
				</section>
			)}

			<ProfileLinkedWallets />

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
				<LRNHistoryChart address={walletAddress} />
			</section>

			<ActivityFeed address={walletAddress} limit={10} />
		</div>
	)
}

export default Profile
