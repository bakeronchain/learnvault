import {
	ShieldCheck,
	ShieldAlert,
	ArrowLeft,
	Copy,
	Check,
	ExternalLink,
	ChevronDown,
	ChevronUp,
} from "lucide-react"
import React, { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useNetwork } from "../providers/NetworkProvider"

interface VerifyResponse {
	valid: boolean
	learner_address: string
	course: {
		id: string
		title: string
	}
	issued_at: string
	token_id: number | null
	tx_hash: string
	signature: string
}

export default function VerifyDetail() {
	const { id } = useParams<{ id: string }>()
	const { config } = useNetwork()
	const [data, setData] = useState<VerifyResponse | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [copiedSig, setCopiedSig] = useState(false)
	const [showInstructions, setShowInstructions] = useState(false)

	useEffect(() => {
		if (!id) return

		const load = async () => {
			try {
				setLoading(true)
				setError(null)

				const res = await fetch(`/api/verify/credentials/${id}`)

				if (!res.ok) {
					throw new Error("Failed to fetch verification status")
				}

				const payload: VerifyResponse = await res.json()
				setData(payload)
			} catch (err) {
				setError(err instanceof Error ? err.message : "Unknown error")
			} finally {
				setLoading(false)
			}
		}

		void load()
	}, [id])

	const handleCopySig = () => {
		if (!data?.signature) return
		navigator.clipboard.writeText(data.signature).catch((err) => {
			console.error("Failed to copy signature:", err)
		})
		setCopiedSig(true)
		setTimeout(() => setCopiedSig(false), 2000)
	}

	if (loading) {
		return (
			<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white px-6">
				<div className="flex flex-col items-center space-y-4">
					<div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
					<p className="text-slate-400 text-sm animate-pulse">
						Resolving credential status...
					</p>
				</div>
			</div>
		)
	}

	if (error || !data) {
		return (
			<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white px-6">
				<div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-6">
					<div className="w-16 h-16 bg-red-950 border border-red-500 rounded-full flex items-center justify-center mx-auto text-red-400">
						<ShieldAlert size={32} />
					</div>
					<div className="space-y-2">
						<h1 className="text-2xl font-bold">Verification Failed</h1>
						<p className="text-slate-400 text-sm">
							{error || "Could not resolve credential status."}
						</p>
					</div>
					<Link
						to="/"
						className="inline-flex items-center space-x-2 text-violet-400 hover:text-violet-300 font-medium text-sm transition-colors"
					>
						<ArrowLeft size={16} />
						<span>Back to Home</span>
					</Link>
				</div>
			</div>
		)
	}

	const dateStr = data.issued_at
		? new Date(data.issued_at).toLocaleDateString(undefined, {
				dateStyle: "long",
			})
		: "Unknown"

	const truncatedAddress = data.learner_address
		? `${data.learner_address.slice(0, 6)}...${data.learner_address.slice(-6)}`
		: "N/A"

	const truncatedTxHash = data.tx_hash
		? `${data.tx_hash.slice(0, 8)}...${data.tx_hash.slice(-8)}`
		: ""

	return (
		<div className="min-h-screen bg-slate-950 text-white py-16 px-6 relative overflow-hidden">
			<div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px] pointer-events-none"></div>
			<div className="absolute bottom-10 left-1/4 w-80 h-80 bg-blue-600/5 rounded-full blur-[100px] pointer-events-none"></div>

			<div className="max-w-2xl mx-auto space-y-8 relative z-10">
				<div className="flex items-center justify-between">
					<Link
						to={
							data.valid && data.learner_address
								? `/profile/${data.learner_address}`
								: "/"
						}
						className="inline-flex items-center space-x-2 text-slate-400 hover:text-white text-sm transition-colors"
					>
						<ArrowLeft size={16} />
						<span>Back to Learner Profile</span>
					</Link>
					<span className="text-xs text-slate-500">ID: {id}</span>
				</div>

				<div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
					{data.valid ? (
						<div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full pointer-events-none border-b border-l border-emerald-500/10"></div>
					) : (
						<div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-bl-full pointer-events-none border-b border-l border-red-500/10"></div>
					)}

					<div className="flex flex-col items-center text-center space-y-6">
						{data.valid ? (
							<>
								<div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
									<ShieldCheck size={44} />
								</div>
								<div className="space-y-2">
									<span className="text-xs uppercase tracking-widest text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-full">
										Verified Credential
									</span>
									<h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl mt-3">
										Authentic LearnVault Certificate
									</h2>
									<p className="text-slate-400 max-w-md text-sm">
										This credential was verified on-chain via the Stellar
										network. The cryptographically signed statement has not been
										altered.
									</p>
								</div>
							</>
						) : (
							<>
								<div className="w-20 h-20 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
									<ShieldAlert size={44} />
								</div>
								<div className="space-y-2">
									<span className="text-xs uppercase tracking-widest text-red-400 font-bold bg-red-500/10 px-3 py-1 rounded-full">
										Invalid / Revoked
									</span>
									<h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl mt-3">
										Credential Status Invalid
									</h2>
									<p className="text-slate-400 max-w-md text-sm">
										This credential ID is either revoked, transferred, or has
										not been issued by the official LearnVault contract.
									</p>
								</div>
							</>
						)}

						<div className="w-full border-t border-slate-800/80 pt-8 mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
							<div className="space-y-1">
								<span className="text-xs text-slate-500 font-medium">
									Course Title
								</span>
								<p className="text-white font-semibold text-base">
									{data.course.title || "N/A"}
								</p>
							</div>

							<div className="space-y-1">
								<span className="text-xs text-slate-500 font-medium">
									Recipient Address
								</span>
								{data.learner_address ? (
									<Link
										to={`/profile/${data.learner_address}`}
										className="text-violet-400 hover:text-violet-300 font-semibold text-base flex items-center space-x-1 hover:underline"
									>
										<span>{truncatedAddress}</span>
										<ExternalLink size={14} />
									</Link>
								) : (
									<p className="text-white font-semibold text-base">N/A</p>
								)}
							</div>

							<div className="space-y-1">
								<span className="text-xs text-slate-500 font-medium">
									Issue Date
								</span>
								<p className="text-slate-300 text-sm font-semibold">
									{dateStr}
								</p>
							</div>

							<div className="space-y-1">
								<span className="text-xs text-slate-500 font-medium">
									Token ID
								</span>
								<p className="text-slate-300 text-sm font-semibold">#{id}</p>
							</div>

							{data.tx_hash && (
								<div className="space-y-1 md:col-span-2 border-t border-slate-800/50 pt-4">
									<span className="text-xs text-slate-500 font-medium">
										Mint Transaction
									</span>
									<div className="flex items-center justify-between">
										<a
											href={`${config.explorerUrl}/tx/${data.tx_hash}`}
											target="_blank"
											rel="noreferrer"
											className="text-violet-400 hover:text-violet-300 font-medium text-sm flex items-center space-x-1 hover:underline"
										>
											<span>{truncatedTxHash}</span>
											<ExternalLink size={14} />
										</a>
										<span className="text-xs text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md font-mono">
											Verified on Stellar
										</span>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>

				<div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center space-y-0.5 space-x-2">
							<div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
							<span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
								HMAC Server Signature
							</span>
						</div>
						{data.signature && (
							<button
								onClick={handleCopySig}
								className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center space-x-1 text-xs"
								title="Copy signature hash"
							>
								{copiedSig ? (
									<Check size={14} className="text-emerald-400" />
								) : (
									<Copy size={14} />
								)}
								<span>{copiedSig ? "Copied" : "Copy"}</span>
							</button>
						)}
					</div>

					{data.signature ? (
						<div className="bg-slate-950 rounded-xl p-3 border border-slate-850 font-mono text-xs text-slate-400 break-all select-all">
							{data.signature}
						</div>
					) : (
						<p className="text-xs text-slate-500 italic">
							No signature generated.
						</p>
					)}

					<button
						onClick={() => setShowInstructions(!showInstructions)}
						className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-white border-t border-slate-800/50 pt-4 mt-2"
					>
						<span>How does offline verification work?</span>
						{showInstructions ? (
							<ChevronUp size={16} />
						) : (
							<ChevronDown size={16} />
						)}
					</button>

					{showInstructions && (
						<div className="text-xs text-slate-400 space-y-3 pt-2">
							<p>
								LearnVault uses a symmetric key system (HMAC-SHA256) to sign the
								payload elements. Anyone with the server secret key can compute
								and match the signature to prove the data was generated by the
								platform and was not tampered with.
							</p>
							<div className="bg-slate-950 p-3 rounded-lg font-mono text-[10px] text-slate-500 overflow-x-auto">
								<span className="text-slate-400">
									// Reconstruct sign string:
								</span>
								<br />
								const msg = `{"{"}tokenId{"}"}:{"{"}recipient{"}"}:{"{"}courseId
								{"}"}:{"{"}issuedAt{"}"}:{"{"}valid{"}"}`;
								<br />
								<br />
								<span className="text-slate-400">// Verify:</span>
								<br />
								const matches = hmacSha256(msg, SECRET) === signature;
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
