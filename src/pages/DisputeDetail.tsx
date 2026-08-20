import { Card } from "@stellar/design-system"
import { Link, useParams } from "react-router-dom"
import { useDispute } from "../hooks/useDisputes"
import { getIpfsUrl } from "../lib/ipfs"
import {
	explorerTransactionUrl,
	shortenAddress,
} from "../util/scholarshipApplications"

function formatDeadline(iso: string | null): string {
	if (!iso) return "--"
	return new Date(iso).toLocaleString()
}

const PHASE_LABELS: Record<string, string> = {
	active: "Voting in progress",
	resolved: "Resolved",
	quorum_failed: "Quorum not met",
}

export default function DisputeDetail() {
	const { id } = useParams<{ id: string }>()
	const { data, isLoading, error } = useDispute(id ?? null)
	const dispute = data?.data

	return (
		<div className="min-h-screen px-4 py-16 sm:px-6 md:px-8">
			<div className="mx-auto flex max-w-4xl flex-col gap-8">
				<section className="glass-card rounded-[2rem] border border-white/10 px-4 sm:px-6 py-6 sm:py-8 shadow-2xl">
					<p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.35em] text-brand-cyan/70">
						Milestone arbitration
					</p>
					<h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
						Dispute #{id}
					</h1>
					<Link
						to="/disputes"
						className="mt-3 inline-flex text-xs font-semibold text-brand-cyan underline"
					>
						Back to juror console
					</Link>
				</section>

				{isLoading ? (
					<p className="text-sm text-white/60">Loading...</p>
				) : error || !dispute ? (
					<p className="text-sm text-red-300">Dispute not found.</p>
				) : (
					<>
						<div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 sm:p-6 shadow-xl backdrop-blur-xl">
							<Card>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<h2 className="text-lg sm:text-xl font-black text-white">
										{PHASE_LABELS[dispute.phase] ?? dispute.phase}
									</h2>
									<span
										className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
											dispute.phase === "active"
												? "bg-blue-500/10 text-blue-400"
												: dispute.phase === "resolved"
													? "bg-green-500/10 text-green-400"
													: "bg-yellow-500/10 text-yellow-400"
										}`}
									>
										{dispute.phase}
									</span>
								</div>

								<div className="mt-4 grid gap-3 text-xs sm:text-sm text-white/70 sm:grid-cols-2">
									<p>
										<span className="font-semibold text-white">Scholar:</span>{" "}
										{shortenAddress(dispute.scholar_address)}
									</p>
									<p>
										<span className="font-semibold text-white">Proposal:</span>{" "}
										#{dispute.proposal_id}
									</p>
									<p>
										<span className="font-semibold text-white">Milestone:</span>{" "}
										#{dispute.milestone_id}
									</p>
									<p>
										<span className="font-semibold text-white">
											Scholar stake:
										</span>{" "}
										{Number(dispute.scholar_stake) / 10_000_000} LRN
									</p>
									<p>
										<span className="font-semibold text-white">
											Commit deadline:
										</span>{" "}
										{formatDeadline(dispute.commit_deadline)}
									</p>
									<p>
										<span className="font-semibold text-white">
											Reveal deadline:
										</span>{" "}
										{formatDeadline(dispute.reveal_deadline)}
									</p>
								</div>

								{dispute.evidence_ipfs_cid && (
									<a
										href={getIpfsUrl(dispute.evidence_ipfs_cid)}
										target="_blank"
										rel="noreferrer"
										className="mt-4 inline-flex text-xs sm:text-sm text-brand-cyan underline"
									>
										View evidence on IPFS
									</a>
								)}
							</Card>
						</div>

						<div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 sm:p-6 shadow-xl backdrop-blur-xl">
							<Card>
								<h2 className="text-lg sm:text-xl font-black text-white">
									Vote tally{" "}
									{dispute.phase === "active" ? "(hidden until reveal)" : ""}
								</h2>
								<div className="mt-4 grid grid-cols-3 gap-3 text-center">
									<div className="rounded-2xl border border-white/10 p-4">
										<p className="text-2xl font-black text-green-400">
											{dispute.votes_for}
										</p>
										<p className="text-xs text-white/50">Release</p>
									</div>
									<div className="rounded-2xl border border-white/10 p-4">
										<p className="text-2xl font-black text-red-400">
											{dispute.votes_against}
										</p>
										<p className="text-xs text-white/50">Uphold</p>
									</div>
									<div className="rounded-2xl border border-white/10 p-4">
										<p className="text-2xl font-black text-white">
											{dispute.revealed_count}
										</p>
										<p className="text-xs text-white/50">Revealed</p>
									</div>
								</div>

								{dispute.phase !== "active" && (
									<div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
										<p className="text-sm font-semibold text-white">
											{dispute.phase === "quorum_failed"
												? "Quorum was not reached -- the rejection stands and the scholar's stake was refunded."
												: dispute.outcome
													? "The panel ruled in favor of the scholar -- the milestone tranche was released."
													: "The panel upheld the rejection."}
										</p>
										{dispute.resolve_tx_hash && (
											<a
												href={explorerTransactionUrl(dispute.resolve_tx_hash)}
												target="_blank"
												rel="noreferrer"
												className="mt-2 inline-flex text-xs text-brand-cyan underline"
											>
												View resolution transaction
											</a>
										)}
									</div>
								)}
							</Card>
						</div>

						<div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 sm:p-6 shadow-xl backdrop-blur-xl">
							<Card>
								<h2 className="text-lg sm:text-xl font-black text-white">
									Panel
								</h2>
								<div className="mt-4 space-y-2">
									{dispute.jurors.map((juror) => (
										<div
											key={juror.juror_address}
											className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-2 text-xs sm:text-sm text-white/70"
										>
											<span>{shortenAddress(juror.juror_address)}</span>
											<span className="flex gap-2">
												{juror.has_committed && (
													<span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-blue-400">
														committed
													</span>
												)}
												{juror.has_revealed && (
													<span className="rounded-full bg-green-500/10 px-2 py-0.5 text-green-400">
														revealed
													</span>
												)}
											</span>
										</div>
									))}
								</div>
							</Card>
						</div>
					</>
				)}
			</div>
		</div>
	)
}
