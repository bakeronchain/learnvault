import { useCallback, useEffect, useState } from "react"
import { getAuthToken } from "../util/auth"

type ReferralStats = {
	pending_count: number
	qualified_count: number
	rewarded_count: number
}

type ReferralInfo = {
	code: string
	link: string
	stats: ReferralStats
}

type ReferralRow = {
	id: number
	referred_addr: string
	status: string
	qualified_at: string | null
	created_at: string
}

type CopyState = "idle" | "copied" | "error"

export function ReferralCard() {
	const [info, setInfo] = useState<ReferralInfo | null>(null)
	const [referrals, setReferrals] = useState<ReferralRow[]>([])
	const [loading, setLoading] = useState(true)
	const [copyState, setCopyState] = useState<CopyState>("idle")
	const [error, setError] = useState<string | null>(null)

	const fetchInfo = useCallback(async () => {
		const token = getAuthToken()
		if (!token) return

		try {
			const [infoRes, listRes] = await Promise.all([
				fetch("/api/referrals/code", {
					headers: { Authorization: `Bearer ${token}` },
				}),
				fetch("/api/referrals/mine", {
					headers: { Authorization: `Bearer ${token}` },
				}),
			])

			if (infoRes.ok) {
				const data = (await infoRes.json()) as ReferralInfo
				setInfo(data)
			} else {
				setError("Failed to load referral info")
			}
			if (listRes.ok) {
				const data = (await listRes.json()) as { data: ReferralRow[] }
				setReferrals(data.data)
			}
		} catch {
			setError("Failed to load referral info")
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		void fetchInfo()
	}, [fetchInfo])

	const handleCopy = async () => {
		if (!info) return
		try {
			await navigator.clipboard.writeText(info.link)
			setCopyState("copied")
			setTimeout(() => setCopyState("idle"), 2000)
		} catch {
			setCopyState("error")
			setTimeout(() => setCopyState("idle"), 2000)
		}
	}

	const handleShareTwitter = () => {
		if (!info) return
		const text = encodeURIComponent(
			`Join me on LearnVault and start learning! Use my referral link: ${info.link}`,
		)
		window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank")
	}

	if (loading) return null

	return (
		<section className="mb-12">
			<div className="flex items-center gap-4 mb-6">
				<h2 className="text-2xl font-black tracking-tight">Invite Friends</h2>
				<div className="h-px flex-1 bg-linear-to-r from-white/10 to-transparent" />
			</div>
			<div className="glass-card rounded-3xl p-6 border border-white/10">
				{error ? (
					<p className="text-sm text-red-400">{error}</p>
				) : !info ? (
					<p className="text-sm text-white/50">
						Connect wallet to get your referral link.
					</p>
				) : (
					<>
						<div className="flex flex-wrap items-center gap-3 mb-6">
							<code className="flex-1 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm font-mono text-brand-cyan truncate min-w-0">
								{info.link}
							</code>
							<button
								onClick={handleCopy}
								className="px-4 py-3 rounded-2xl border border-brand-cyan/30 bg-brand-cyan/10 text-sm font-medium text-brand-cyan hover:bg-brand-cyan/20 transition-colors whitespace-nowrap"
							>
								{copyState === "copied"
									? "Copied!"
									: copyState === "error"
										? "Error"
										: "Copy Link"}
							</button>
							<button
								onClick={handleShareTwitter}
								className="px-4 py-3 rounded-2xl border border-white/10 bg-white/5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap"
							>
								Share
							</button>
						</div>

						<div className="flex gap-6 mb-6 text-sm">
							<div>
								<span className="text-white/50">Pending: </span>
								<span className="font-mono text-white/90">
									{info.stats.pending_count}
								</span>
							</div>
							<div>
								<span className="text-white/50">Qualified: </span>
								<span className="font-mono text-brand-cyan">
									{info.stats.qualified_count}
								</span>
							</div>
							<div>
								<span className="text-white/50">Rewarded: </span>
								<span className="font-mono text-brand-emerald">
									{info.stats.rewarded_count}
								</span>
							</div>
						</div>

						{referrals.length > 0 && (
							<>
								<h3 className="text-sm font-black tracking-tight mb-3">
									Your Referrals
								</h3>
								<ul className="space-y-2">
									{referrals.map((r) => (
										<li
											key={r.id}
											className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5"
										>
											<code className="text-xs font-mono text-white/60 truncate">
												{r.referred_addr.slice(0, 8)}...
											</code>
											<span
												className={`text-[10px] uppercase font-black tracking-widest ${
													r.status === "qualified"
														? "text-brand-cyan"
														: r.status === "rewarded"
															? "text-brand-emerald"
															: "text-white/40"
												}`}
											>
												{r.status}
											</span>
										</li>
									))}
								</ul>
							</>
						)}
					</>
				)}
			</div>
		</section>
	)
}
