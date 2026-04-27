import React, { useEffect, useState } from "react"
import { usePeerReviewQueue } from "../hooks/usePeerReview"
import { useWallet } from "../hooks/useWallet"
import AddressDisplay from "../components/AddressDisplay"

function evidenceLabel(row: {
	evidence_github?: string | null
	evidence_ipfs_cid?: string | null
	evidence_description?: string | null
}): string {
	return (
		row.evidence_github ??
		row.evidence_ipfs_cid ??
		row.evidence_description ??
		""
	)
}

const PeerReview: React.FC = () => {
	const { address } = useWallet()
	const { items, loading, error, refresh, submitReview } = usePeerReviewQueue()
	const [busyId, setBusyId] = useState<number | null>(null)
	const [lastReward, setLastReward] = useState<string | null>(null)

	useEffect(() => {
		if (!address) return
		void refresh()
	}, [address, refresh])

	if (!address) {
		return (
			<div className="min-h-screen py-24 px-6">
				<div className="max-w-3xl mx-auto glass rounded-2xl border border-white/10 p-10 text-center">
					<h1 className="text-3xl font-bold text-white mb-3">Peer review</h1>
					<p className="text-white/50">
						Connect your wallet to see milestone submissions you can review as
						an experienced scholar.
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="min-h-screen py-24 px-6">
			<div className="max-w-4xl mx-auto">
				<header className="mb-10">
					<h1 className="text-4xl font-black tracking-tight text-gradient mb-2">
						Peer review queue
					</h1>
					<p className="text-white/50 max-w-2xl">
						Your review is a signal for admins — it does not approve or reject
						milestones on its own. Completing a review earns LRN in your
						scholar balance.
					</p>
					{lastReward && (
						<p className="mt-3 text-sm text-emerald-400/90">
							Last reward credited: {lastReward} LRN
						</p>
					)}
				</header>

				{error && (
					<p className="text-sm text-red-400 mb-4" role="alert">
						{error}
					</p>
				)}

				<button
					type="button"
					onClick={() => void refresh()}
					className="mb-6 text-xs uppercase tracking-widest text-brand-cyan border border-brand-cyan/30 rounded-lg px-4 py-2 hover:bg-brand-cyan/10 transition-colors"
				>
					Refresh queue
				</button>

				{loading && (
					<p className="text-white/40 text-sm animate-pulse">Loading queue…</p>
				)}

				{!loading && items.length === 0 && (
					<div className="glass rounded-2xl border border-white/10 p-10 text-center text-white/45 text-sm">
						No submissions are available for you to review right now. You may
						already have reviewed them, be enrolled in the same course, or need
						a higher LRN balance to qualify.
					</div>
				)}

				<ul className="space-y-4">
					{items.map((row) => {
						const ev = evidenceLabel(row)
						const approvals = row.peer_approval_count ?? 0
						const rejections = row.peer_rejection_count ?? 0
						const busy = busyId === row.id

						return (
							<li
								key={row.id}
								className="glass rounded-2xl border border-white/10 p-6 flex flex-col gap-4"
							>
								<div className="flex flex-wrap gap-4 justify-between items-start">
									<div>
										<p className="text-xs uppercase tracking-widest text-white/35 mb-1">
											Report #{row.id}
										</p>
										<p className="text-sm text-white/80">
											Course:{" "}
											<span className="text-white">{row.course_id}</span> ·
											Milestone {row.milestone_id}
										</p>
										<p className="text-xs text-white/45 mt-2">
											Learner{" "}
											<AddressDisplay
												address={row.scholar_address}
												prefixLength={6}
												suffixLength={4}
												showExplorerLink
											/>
										</p>
									</div>
									<div className="text-xs text-white/40 text-right">
										<div>Peer signals</div>
										<div className="text-white/70 font-mono mt-1">
											+{approvals} / −{rejections}
										</div>
									</div>
								</div>
								<div className="text-xs text-white/50 break-all">
									{!ev ? (
										<span className="text-white/30">No evidence link</span>
									) : ev.startsWith("http") ? (
										<a
											href={ev}
											target="_blank"
											rel="noopener noreferrer"
											className="text-brand-cyan hover:underline"
										>
											{ev}
										</a>
									) : (
										<span className="text-white/70">{ev}</span>
									)}
								</div>
								<div className="flex flex-wrap gap-2">
									<button
										type="button"
										disabled={busy}
										onClick={async () => {
											setBusyId(row.id)
											const out = await submitReview(row.id, "approve")
											if (out?.lrn_awarded) setLastReward(out.lrn_awarded)
											setBusyId(null)
										}}
										className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/25 disabled:opacity-40"
									>
										Signal approve
									</button>
									<button
										type="button"
										disabled={busy}
										onClick={async () => {
											setBusyId(row.id)
											const out = await submitReview(row.id, "reject")
											if (out?.lrn_awarded) setLastReward(out.lrn_awarded)
											setBusyId(null)
										}}
										className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-500/15 text-red-300 border border-red-500/35 hover:bg-red-500/25 disabled:opacity-40"
									>
										Signal reject
									</button>
								</div>
							</li>
						)
					})}
				</ul>
			</div>
		</div>
	)
}

export default PeerReview
