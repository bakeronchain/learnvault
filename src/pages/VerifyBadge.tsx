import { ShieldCheck, ShieldAlert, ExternalLink } from "lucide-react"
import React, { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
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
}

export default function VerifyBadge() {
	const { id } = useParams<{ id: string }>()
	const { config } = useNetwork()
	const [data, setData] = useState<VerifyResponse | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(false)

	useEffect(() => {
		if (!id) return
		setLoading(true)
		setError(false)
		fetch(`/api/verify/credentials/${id}`)
			.then((res) => {
				if (!res.ok) throw new Error("Failed to fetch")
				return res.json() as Promise<VerifyResponse>
			})
			.then((payload) => {
				setData(payload)
			})
			.catch(() => {
				setError(true)
			})
			.finally(() => {
				setLoading(false)
			})
	}, [id])

	if (loading) {
		return (
			<div className="h-full w-full rounded-2xl border border-white/15 bg-[#05080f] p-5 text-white flex items-center justify-center">
				<div className="flex items-center space-x-2">
					<div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
					<span className="text-xs text-white/50">Verifying credential...</span>
				</div>
			</div>
		)
	}

	if (error || !data) {
		return (
			<div className="h-full w-full rounded-2xl border border-red-500/20 bg-[#11070b] p-5 text-white flex flex-col justify-between">
				<div>
					<p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-400">
						LearnVault Verification
					</p>
					<p className="mt-3 text-xs text-red-200/80 font-medium">
						Failed to retrieve status
					</p>
				</div>
				<div className="flex items-center space-x-1.5 text-[9px] text-red-400">
					<ShieldAlert size={12} />
					<span>Invalid Token ID</span>
				</div>
			</div>
		)
	}

	const truncatedAddress = data.learner_address
		? `${data.learner_address.slice(0, 6)}...${data.learner_address.slice(-4)}`
		: "N/A"

	return (
		<div className="h-full w-full rounded-2xl border border-white/15 bg-[#05080f] p-5 text-white flex flex-col justify-between select-none">
			<div>
				<div className="flex items-center justify-between">
					<span className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-400">
						Verified Certificate
					</span>
					{data.valid ? (
						<div className="w-5 h-5 bg-emerald-500/10 border border-emerald-500/35 rounded-full flex items-center justify-center text-emerald-400">
							<ShieldCheck size={12} />
						</div>
					) : (
						<div className="w-5 h-5 bg-red-500/10 border border-red-500/35 rounded-full flex items-center justify-center text-red-400">
							<ShieldAlert size={12} />
						</div>
					)}
				</div>

				<h3 className="mt-3 text-sm font-bold text-white line-clamp-1 leading-snug">
					{data.course.title || "Course Completed"}
				</h3>
				<p className="mt-1 text-xs text-white/60">
					Issued to{" "}
					<span className="font-semibold text-white/80">
						{truncatedAddress}
					</span>
				</p>
			</div>

			<div className="flex items-center justify-between border-t border-white/5 pt-3 mt-2">
				{data.valid ? (
					<span className="text-[9px] font-medium text-emerald-400 flex items-center space-x-1">
						<span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
						<span>Verified on Stellar</span>
					</span>
				) : (
					<span className="text-[9px] font-medium text-red-400 flex items-center space-x-1">
						<span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400"></span>
						<span>Revoked / Invalid</span>
					</span>
				)}

				{data.tx_hash && data.valid && (
					<a
						href={`${config.explorerUrl}/tx/${data.tx_hash}`}
						target="_blank"
						rel="noreferrer"
						className="text-[9px] text-white/40 hover:text-violet-400 flex items-center space-x-0.5 transition-colors"
						title="View Tx on Stellar Expert"
					>
						<span>Explore Tx</span>
						<ExternalLink size={10} />
					</a>
				)}
			</div>
		</div>
	)
}
