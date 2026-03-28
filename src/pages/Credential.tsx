import React, { useState } from "react"
import { Helmet } from "react-helmet"
import { useParams } from "react-router-dom"
import TxHashLink from "../components/TxHashLink"
import { useScholarNft } from "../hooks/useScholarNft"

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

const SkeletonPulse: React.FC<{ className?: string }> = ({ className }) => (
	<div
		className={`animate-pulse rounded-xl bg-white/10 ${className ?? ""}`}
	/>
)

const CredentialSkeleton: React.FC = () => (
	<div className="py-20 px-6 min-h-screen flex flex-col items-center gap-16 text-white relative overflow-hidden">
		<div className="absolute top-1/4 left-1/4 w-[50%] h-[50%] bg-brand-cyan/10 blur-[150px] rounded-full -z-10" />
		<div className="absolute bottom-1/4 right-1/4 w-[50%] h-[50%] bg-brand-purple/10 blur-[150px] rounded-full -z-10" />

		<div className="iridescent-border p-px rounded-[3rem] shadow-2xl w-full max-w-5xl">
			<div className="glass-card w-full rounded-[3rem] overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/10">
				<div className="md:w-5/12 aspect-square md:aspect-auto">
					<SkeletonPulse className="w-full h-full min-h-[320px] rounded-none" />
				</div>
				<div className="md:w-7/12 p-16 flex flex-col justify-center gap-6">
					<SkeletonPulse className="h-4 w-32" />
					<SkeletonPulse className="h-12 w-full" />
					<SkeletonPulse className="h-6 w-3/4" />
					<div className="grid grid-cols-2 gap-10 mt-6">
						<SkeletonPulse className="h-14 w-full" />
						<SkeletonPulse className="h-14 w-full" />
						<SkeletonPulse className="h-14 w-full col-span-2" />
						<SkeletonPulse className="h-8 w-full col-span-2" />
					</div>
				</div>
			</div>
		</div>

		<div className="flex gap-6">
			<SkeletonPulse className="h-14 w-48" />
			<SkeletonPulse className="h-14 w-48" />
		</div>
	</div>
)

// ---------------------------------------------------------------------------
// Error states
// ---------------------------------------------------------------------------

interface ErrorStateProps {
	title: string
	message: string
	icon: string
}

const ErrorState: React.FC<ErrorStateProps> = ({ title, message, icon }) => (
	<div className="py-20 px-6 min-h-screen flex flex-col items-center justify-center gap-8 text-white relative overflow-hidden">
		<div className="absolute top-1/4 left-1/4 w-[50%] h-[50%] bg-red-500/10 blur-[150px] rounded-full -z-10" />

		<div className="glass-card rounded-[2rem] p-16 text-center max-w-lg animate-in fade-in zoom-in duration-700">
			<div className="text-6xl mb-6">{icon}</div>
			<h1 className="text-3xl font-black mb-4 tracking-tight">{title}</h1>
			<p className="text-white/60 text-lg leading-relaxed">{message}</p>
			<a
				href="/"
				className="mt-8 inline-block px-8 py-3 bg-brand-cyan/20 text-brand-cyan rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-brand-cyan/30 transition-colors"
			>
				Back to Home
			</a>
		</div>
	</div>
)

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const Credential: React.FC = () => {
	const { nftId } = useParams<{ nftId: string }>()
	const [copySuccess, setCopySuccess] = useState(false)

	const { credential: nft, status, error } = useScholarNft(nftId)

	const copyToClipboard = () => {
		void navigator.clipboard.writeText(window.location.href).catch(() => { })
		setCopySuccess(true)
		setTimeout(() => setCopySuccess(false), 2000)
	}

	// ---- Loading ----
	if (status === "loading") {
		return (
			<>
				<Helmet>
					<title>Loading Credential — LearnVault</title>
				</Helmet>
				<CredentialSkeleton />
			</>
		)
	}

	// ---- Not found ----
	if (status === "not_found") {
		return (
			<>
				<Helmet>
					<title>Credential Not Found — LearnVault</title>
				</Helmet>
				<ErrorState
					icon="🔍"
					title="Credential Not Found"
					message={`Token #${nftId ?? "?"} does not exist on-chain. It may not have been minted yet.`}
				/>
			</>
		)
	}

	// ---- Revoked ----
	if (status === "revoked") {
		return (
			<>
				<Helmet>
					<title>Credential Revoked — LearnVault</title>
				</Helmet>
				<ErrorState
					icon="🚫"
					title="Credential Revoked"
					message={
						error ??
						"This credential has been revoked by the issuer and is no longer valid."
					}
				/>
			</>
		)
	}

	// ---- Error ----
	if (status === "error" || !nft) {
		return (
			<>
				<Helmet>
					<title>Error — LearnVault</title>
				</Helmet>
				<ErrorState
					icon="⚠️"
					title="Unable to Load Credential"
					message={
						error ??
						"Something went wrong while fetching this credential. Please try again later."
					}
				/>
			</>
		)
	}

	// ---- Success ----
	const siteUrl = "https://learnvault.app"
	const title = `${nft.scholarName} earned "${nft.programName}" — LearnVault`
	const description = `${nft.scholarName} completed "${nft.programName}" on ${nft.completionDate} and earned a verified ScholarNFT credential on LearnVault.`

	return (
		<div className="py-20 px-6 min-h-screen flex flex-col items-center gap-16 text-white relative overflow-hidden">
			<Helmet>
				<title>{title}</title>
				<meta name="description" content={description} />
				<meta property="og:title" content={title} />
				<meta property="og:description" content={description} />
				<meta property="og:url" content={`${siteUrl}/credential/${nft.id}`} />
				{nft.artworkUrl && (
					<meta property="og:image" content={nft.artworkUrl} />
				)}
				<meta name="twitter:card" content="summary_large_image" />
				<meta name="twitter:title" content={title} />
				<meta name="twitter:description" content={description} />
			</Helmet>

			<div className="absolute top-1/4 left-1/4 w-[50%] h-[50%] bg-brand-cyan/10 blur-[150px] rounded-full -z-10" />
			<div className="absolute bottom-1/4 right-1/4 w-[50%] h-[50%] bg-brand-purple/10 blur-[150px] rounded-full -z-10" />

			<div className="iridescent-border p-px rounded-[3rem] shadow-2xl animate-in fade-in zoom-in duration-1000">
				<div className="glass-card w-full max-w-5xl rounded-[3rem] overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/10">
					<div className="md:w-5/12 relative aspect-square md:aspect-auto group">
						{nft.artworkUrl ? (
							<img
								src={nft.artworkUrl}
								alt={`Credential artwork for ${nft.programName} awarded to ${nft.scholarName}`}
								className="w-full h-full object-cover opacity-90 group-hover:scale-110 transition-transform duration-1000"
								onError={(e) => {
									const target = e.currentTarget
									target.style.display = "none"
								}}
							/>
						) : (
							<div className="w-full h-full min-h-[320px] bg-gradient-to-br from-brand-cyan/20 to-brand-purple/20 flex items-center justify-center">
								<span className="text-6xl opacity-50">🎓</span>
							</div>
						)}
						<div className="absolute inset-0 bg-linear-to-t from-black/80 to-transparent" />
						<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 px-8 py-3 border-[6px] border-brand-cyan text-brand-cyan font-black text-2xl tracking-[6px] bg-black/40 backdrop-blur-md whitespace-nowrap uppercase shadow-2xl">
							Verified Scholar
						</div>
						<div className="absolute bottom-8 left-8">
							<p className="text-[10px] font-black uppercase tracking-[3px] text-white/70 mb-1">
								Authenticity Hash
							</p>
							<code className="text-[10px] text-brand-emerald font-mono bg-black/50 px-2 py-1 rounded">
								LV-NFT-{nft.id}-Soroban
							</code>
						</div>
					</div>

					<div className="md:w-7/12 p-16 flex flex-col justify-center">
						<div className="mb-10">
							<div className="flex items-center gap-3 mb-4">
								<span className="w-8 h-px bg-brand-cyan" />
								<span className="text-xs font-black uppercase tracking-[4px] text-brand-cyan">
									Official Credential
								</span>
							</div>
							<h1 className="text-5xl font-black mb-6 leading-tight tracking-tighter">
								{nft.programName}
							</h1>
							<p className="text-white/70 text-lg font-medium leading-relaxed">
								This on-chain certificate verifies that{" "}
								<span className="text-white font-bold">
									{nft.scholarName}
								</span>{" "}
								has successfully completed the program and earned a
								verified ScholarNFT credential.
							</p>
						</div>

						<div className="grid grid-cols-2 gap-10 mb-12">
							<div>
								<p className="block text-[10px] uppercase font-black text-white/70 tracking-[3px] mb-2">
									Awarded Date
								</p>
								<p className="text-lg font-bold">
									{nft.completionDate}
								</p>
							</div>
							{nft.reputationPoints && (
								<div>
									<p className="block text-[10px] uppercase font-black text-white/70 tracking-[3px] mb-2">
										Reputation Earned
									</p>
									<p className="text-lg font-black text-brand-emerald">
										+{nft.reputationPoints}
									</p>
								</div>
							)}
							<div className="col-span-2">
								<p className="block text-[10px] uppercase font-black text-white/70 tracking-[3px] mb-2">
									Issued By
								</p>
								<div className="flex items-center gap-3">
									<div className="w-8 h-8 rounded-full bg-linear-to-r from-brand-cyan to-brand-blue" />
									<p className="text-lg font-bold text-gradient">
										{nft.issuer}
									</p>
								</div>
							</div>
							<div className="col-span-2">
								<p className="block text-[10px] uppercase font-black text-white/70 tracking-[3px] mb-2">
									Owner
								</p>
								<code className="text-xs font-mono text-brand-cyan bg-black/30 px-3 py-1.5 rounded-lg break-all">
									{nft.owner}
								</code>
							</div>
							{nft.txHash && (
								<div className="col-span-2">
									<label className="block text-[10px] uppercase font-black text-white/30 tracking-[3px] mb-2">
										Transaction Hash
									</label>
									<TxHashLink
										hash={nft.txHash}
										className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#00d2ff] hover:underline"
									/>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			<div className="flex flex-wrap justify-center gap-6 animate-in slide-in-from-bottom-8 duration-1000 delay-300">
				<a
					href={`https://twitter.com/intent/tweet?text=I've just earned my ${encodeURIComponent(nft.programName)} credential on @LearnVault!`}
					className="px-10 py-4 bg-[#1d9bf0] text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#1d9bf0]/20"
					aria-label={`Share ${nft.programName} credential on Twitter`}
				>
					Share to Twitter / X
				</a>
				<button
					type="button"
					onClick={copyToClipboard}
					className="px-10 py-4 glass text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/10 hover:scale-105 active:scale-95 transition-all border border-white/10"
				>
					{copySuccess ? "Link Copied!" : "Copy Shareable Link"}
				</button>
			</div>
			{copySuccess && (
				<p
					className="text-sm text-brand-emerald"
					role="status"
					aria-live="polite"
				>
					Credential link copied to clipboard.
				</p>
			)}
		</div>
	)
}

export default Credential
