import React, { useState } from "react"
import { Helmet } from "react-helmet"
import { useParams } from "react-router-dom"
import TxHashLink from "../components/TxHashLink"
import { useScholarNft } from "../hooks/useScholarNft"

const SkeletonPulse: React.FC<{ className?: string }> = ({ className }) => (
	<div className={`animate-pulse rounded-xl bg-white/10 ${className ?? ""}`} />
)

const CredentialSkeleton: React.FC = () => (
	<div className="relative flex min-h-screen flex-col items-center gap-16 overflow-hidden px-6 py-20 text-white">
		<div className="absolute left-1/4 top-1/4 h-[50%] w-[50%] rounded-full bg-brand-cyan/10 blur-[150px] -z-10" />
		<div className="absolute bottom-1/4 right-1/4 h-[50%] w-[50%] rounded-full bg-brand-purple/10 blur-[150px] -z-10" />

		<div className="iridescent-border w-full max-w-5xl rounded-[3rem] p-px shadow-2xl">
			<div className="glass-card flex w-full flex-col divide-y divide-white/10 overflow-hidden rounded-[3rem] md:flex-row md:divide-x md:divide-y-0">
				<div className="aspect-square md:w-5/12 md:aspect-auto">
					<SkeletonPulse className="h-full min-h-[320px] w-full rounded-none" />
				</div>
				<div className="flex flex-col justify-center gap-6 p-16 md:w-7/12">
					<SkeletonPulse className="h-4 w-32" />
					<SkeletonPulse className="h-12 w-full" />
					<SkeletonPulse className="h-6 w-3/4" />
					<div className="mt-6 grid grid-cols-2 gap-10">
						<SkeletonPulse className="h-14 w-full" />
						<SkeletonPulse className="h-14 w-full" />
						<SkeletonPulse className="col-span-2 h-14 w-full" />
						<SkeletonPulse className="col-span-2 h-8 w-full" />
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

interface ErrorStateProps {
	title: string
	message: string
	icon: string
}

const ErrorState: React.FC<ErrorStateProps> = ({ title, message, icon }) => (
	<div className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden px-6 py-20 text-white">
		<div className="absolute left-1/4 top-1/4 h-[50%] w-[50%] rounded-full bg-red-500/10 blur-[150px] -z-10" />

		<div className="glass-card max-w-lg rounded-[2rem] p-16 text-center duration-700 animate-in fade-in zoom-in">
			<div className="mb-6 text-6xl">{icon}</div>
			<h1 className="mb-4 text-3xl font-black tracking-tight">{title}</h1>
			<p className="text-lg leading-relaxed text-white/60">{message}</p>
			<a
				href="/"
				className="mt-8 inline-block rounded-xl bg-brand-cyan/20 px-8 py-3 text-sm font-bold uppercase tracking-widest text-brand-cyan transition-colors hover:bg-brand-cyan/30"
			>
				Back to Home
			</a>
		</div>
	</div>
)

const Credential: React.FC = () => {
	const { id } = useParams<{ id: string }>()
	const nftId = id?.trim() || undefined
	const [copySuccess, setCopySuccess] = useState(false)
	const { credential: nft, status, error } = useScholarNft(nftId)

	const copyToClipboard = () => {
		void navigator.clipboard.writeText(window.location.href).catch(() => {})
		setCopySuccess(true)
		setTimeout(() => setCopySuccess(false), 2000)
	}

	if (status === "loading") {
		return (
			<>
				<Helmet>
					<title>Loading Credential - LearnVault</title>
				</Helmet>
				<CredentialSkeleton />
			</>
		)
	}

	if (status === "not_found") {
		return (
			<>
				<Helmet>
					<title>Credential Not Found - LearnVault</title>
				</Helmet>
				<ErrorState
					icon="?"
					title="Credential Not Found"
					message={`Token #${nftId ?? "?"} does not exist on-chain. It may not have been minted yet.`}
				/>
			</>
		)
	}

	if (status === "revoked") {
		return (
			<>
				<Helmet>
					<title>Credential Revoked - LearnVault</title>
				</Helmet>
				<ErrorState
					icon="!"
					title="Credential Revoked"
					message={
						error ??
						"This credential has been revoked by the issuer and is no longer valid."
					}
				/>
			</>
		)
	}

	if (status === "error" || !nft) {
		return (
			<>
				<Helmet>
					<title>Error - LearnVault</title>
				</Helmet>
				<ErrorState
					icon="!"
					title="Unable to Load Credential"
					message={
						error ??
						"Something went wrong while fetching this credential. Please try again later."
					}
				/>
			</>
		)
	}

	const siteUrl = "https://learnvault.app"
	const title = `${nft.scholarName} earned "${nft.programName}" - LearnVault`
	const description = `${nft.scholarName} completed "${nft.programName}" on ${nft.completionDate} and earned a verified ScholarNFT credential on LearnVault.`
	const shareText = encodeURIComponent(
		`I've just earned my ${nft.programName} credential on @LearnVault!`,
	)

	return (
		<div className="relative flex min-h-screen flex-col items-center gap-16 overflow-hidden px-6 py-20 text-white">
			<Helmet>
				<title>{title}</title>
				<meta name="description" content={description} />
				<meta property="og:title" content={title} />
				<meta property="og:description" content={description} />
				<meta property="og:url" content={`${siteUrl}/credential/${nft.id}`} />
				{nft.artworkUrl ? (
					<meta property="og:image" content={nft.artworkUrl} />
				) : null}
				<meta name="twitter:card" content="summary_large_image" />
				<meta name="twitter:title" content={title} />
				<meta name="twitter:description" content={description} />
			</Helmet>

			<div className="absolute left-1/4 top-1/4 h-[50%] w-[50%] rounded-full bg-brand-cyan/10 blur-[150px] -z-10" />
			<div className="absolute bottom-1/4 right-1/4 h-[50%] w-[50%] rounded-full bg-brand-purple/10 blur-[150px] -z-10" />

			<div className="iridescent-border rounded-[3rem] p-px shadow-2xl duration-1000 animate-in fade-in zoom-in">
				<div className="glass-card flex w-full max-w-5xl flex-col divide-y divide-white/10 overflow-hidden rounded-[3rem] md:flex-row md:divide-x md:divide-y-0">
					<div className="group relative aspect-square md:w-5/12 md:aspect-auto">
						{nft.artworkUrl ? (
							<img
								src={nft.artworkUrl}
								alt={`Credential artwork for ${nft.programName} awarded to ${nft.scholarName}`}
								className="h-full w-full object-cover opacity-90 transition-transform duration-1000 group-hover:scale-110"
								onError={(e) => {
									const target = e.currentTarget
									target.style.display = "none"
								}}
							/>
						) : (
							<div className="flex h-full min-h-[320px] w-full items-center justify-center bg-gradient-to-br from-brand-cyan/20 to-brand-purple/20">
								<span className="text-6xl opacity-50">o</span>
							</div>
						)}
						<div className="absolute inset-0 bg-linear-to-t from-black/80 to-transparent" />
						<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 whitespace-nowrap border-[6px] border-brand-cyan bg-black/40 px-8 py-3 text-2xl font-black uppercase tracking-[6px] text-brand-cyan shadow-2xl backdrop-blur-md">
							Verified Scholar
						</div>
						<div className="absolute bottom-8 left-8">
							<p className="mb-1 text-[10px] font-black uppercase tracking-[3px] text-white/70">
								Authenticity Hash
							</p>
							<code className="rounded bg-black/50 px-2 py-1 font-mono text-[10px] text-brand-emerald">
								LV-NFT-{nft.id}-Soroban
							</code>
						</div>
					</div>

					<div className="flex flex-col justify-center p-16 md:w-7/12">
						<div className="mb-10">
							<div className="mb-4 flex items-center gap-3">
								<span className="h-px w-8 bg-brand-cyan" />
								<span className="text-xs font-black uppercase tracking-[4px] text-brand-cyan">
									Official Credential
								</span>
							</div>
							<h1 className="mb-6 text-5xl font-black leading-tight tracking-tighter">
								{nft.programName}
							</h1>
							<p className="text-lg font-medium leading-relaxed text-white/70">
								This on-chain certificate verifies that{" "}
								<span className="font-bold text-white">{nft.scholarName}</span>{" "}
								has successfully completed the program and earned a verified
								ScholarNFT credential.
							</p>
						</div>

						<div className="mb-12 grid grid-cols-2 gap-10">
							<div>
								<p className="mb-2 block text-[10px] font-black uppercase tracking-[3px] text-white/70">
									Awarded Date
								</p>
								<p className="text-lg font-bold">{nft.completionDate}</p>
							</div>
							{nft.reputationPoints ? (
								<div>
									<p className="mb-2 block text-[10px] font-black uppercase tracking-[3px] text-white/70">
										Reputation Earned
									</p>
									<p className="text-lg font-black text-brand-emerald">
										+{nft.reputationPoints}
									</p>
								</div>
							) : null}
							<div className="col-span-2">
								<p className="mb-2 block text-[10px] font-black uppercase tracking-[3px] text-white/70">
									Issued By
								</p>
								<div className="flex items-center gap-3">
									<div className="h-8 w-8 rounded-full bg-linear-to-r from-brand-cyan to-brand-blue" />
									<p className="text-lg font-bold text-gradient">
										{nft.issuer}
									</p>
								</div>
							</div>
							<div className="col-span-2">
								<p className="mb-2 block text-[10px] font-black uppercase tracking-[3px] text-white/70">
									Owner
								</p>
								<code className="break-all rounded-lg bg-black/30 px-3 py-1.5 font-mono text-xs text-brand-cyan">
									{nft.owner}
								</code>
							</div>
							<div className="col-span-2">
								<p className="mb-2 block text-[10px] font-black uppercase tracking-[3px] text-white/70">
									Metadata URI
								</p>
								<code className="break-all rounded-lg bg-black/50 px-3 py-2 font-mono text-xs text-white/70">
									{nft.metadataUri}
								</code>
							</div>
							{nft.txHash ? (
								<div className="col-span-2">
									<label className="mb-2 block text-[10px] font-black uppercase tracking-[3px] text-white/30">
										Transaction Hash
									</label>
									<TxHashLink
										hash={nft.txHash}
										className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#00d2ff] hover:underline"
									/>
								</div>
							) : null}
						</div>
					</div>
				</div>
			</div>

			<div className="flex flex-wrap justify-center gap-6 duration-1000 delay-300 animate-in slide-in-from-bottom-8">
				{nft.txHash ? (
					<a
						href={`https://stellar.expert/explorer/public/tx/${nft.txHash}`}
						target="_blank"
						rel="noopener noreferrer"
						className="rounded-2xl bg-gradient-to-r from-brand-cyan to-brand-blue px-10 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-brand-cyan/20 transition-all hover:scale-105 active:scale-95"
						aria-label={`Verify ${nft.programName} credential on Stellar Explorer`}
					>
						Verify on-chain
					</a>
				) : null}
				<a
					href={`https://twitter.com/intent/tweet?text=${shareText}`}
					className="rounded-2xl bg-[#1d9bf0] px-10 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-[#1d9bf0]/20 transition-all hover:scale-105 active:scale-95"
					aria-label={`Share ${nft.programName} credential on Twitter`}
				>
					Share to Twitter / X
				</a>
				<button
					type="button"
					onClick={copyToClipboard}
					className="glass rounded-2xl border border-white/10 px-10 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:scale-105 hover:bg-white/10 active:scale-95"
				>
					{copySuccess ? "Link Copied!" : "Copy Shareable Link"}
				</button>
			</div>
			{copySuccess ? (
				<p
					className="text-sm text-brand-emerald"
					role="status"
					aria-live="polite"
				>
					Credential link copied to clipboard.
				</p>
			) : null}
		</div>
	)
}

export default Credential
