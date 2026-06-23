import { Card } from "@stellar/design-system"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import ConnectWalletGuard from "../components/ConnectWalletGuard"
import MilestoneReportForm from "../components/MilestoneReportForm"
import {
	useScholarMilestones,
	type ScholarMilestone,
} from "../hooks/useScholarMilestones"
import { useWallet } from "../hooks/useWallet"
import { getIpfsUrl, isCid, normaliseCid } from "../lib/ipfs"
import {
	type MilestoneReportFormValues,
	type MilestoneReportStatus,
	type SubmittedMilestoneReport,
} from "../types/milestone"
import { shortenAddress } from "../util/scholarshipApplications"

const STATUS_LABELS: Record<MilestoneReportStatus, string> = {
	pending: "Pending Review",
	approved: "Approved",
	rejected: "Rejected",
	appealed: "Appeal Under Review",
	final_rejected: "Appeal Rejected (Final)",
}

const STATUS_COLORS: Record<MilestoneReportStatus, string> = {
	pending: "text-brand-cyan",
	approved: "text-green-400",
	rejected: "text-red-400",
	appealed: "text-yellow-400",
	final_rejected: "text-red-600",
}

const API_BASE =
	(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api/v1"

export default function ScholarMilestones() {
	const { address } = useWallet()
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [submitError, setSubmitError] = useState<string | null>(null)
	const [submittedReport, setSubmittedReport] =
		useState<SubmittedMilestoneReport | null>(null)
	const [resubmitMilestone, setResubmitMilestone] =
		useState<ScholarMilestone | null>(null)

	const { data: milestones = [], isLoading: isLoadingMilestones } =
		useScholarMilestones()

	const ipfsUrl = useMemo(() => {
		if (!submittedReport?.evidence_ipfs_cid) return null
		const cid = normaliseCid(submittedReport.evidence_ipfs_cid)
		return isCid(cid) ? getIpfsUrl(cid) : submittedReport.evidence_ipfs_cid
	}, [submittedReport])

	const handleSubmit = async (
		values: MilestoneReportFormValues,
	): Promise<void> => {
		if (!address) {
			setSubmitError("Connect your wallet before submitting a milestone.")
			return
		}

		setIsSubmitting(true)
		setSubmitError(null)

		try {
			const endpoint = resubmitMilestone
				? `${API_BASE}/milestones/resubmit`
				: `${API_BASE}/milestones/submit`
			const body = resubmitMilestone
				? {
						id: resubmitMilestone.id,
						evidenceGithub: values.evidenceGithub.trim() || undefined,
						evidenceIpfsCid: values.evidenceIpfsCid.trim() || undefined,
						evidenceDescription: values.evidenceDescription.trim() || undefined,
					}
				: {
						scholarAddress: address,
						courseId: values.courseId.trim(),
						milestoneId: Number(values.milestoneId),
						evidenceGithub: values.evidenceGithub.trim() || undefined,
						evidenceIpfsCid: values.evidenceIpfsCid.trim() || undefined,
						evidenceDescription: values.evidenceDescription.trim() || undefined,
					}

			const response = await fetch(endpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			})

			const bodyResp = (await response.json().catch(() => ({}))) as {
				data?: SubmittedMilestoneReport
				error?: string
			}

			if (!response.ok || !bodyResp.data) {
				throw new Error(bodyResp.error ?? "Failed to submit milestone report.")
			}

			setSubmittedReport(bodyResp.data)
			setResubmitMilestone(null)
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to submit milestone report."
			setSubmitError(message)
			throw new Error(message)
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<ConnectWalletGuard>
			<div className="min-h-screen px-4 py-16 sm:px-6 md:px-8">
				<div className="mx-auto flex max-w-6xl flex-col gap-8">
					<section className="glass-card rounded-[2rem] border border-white/10 px-4 sm:px-6 py-6 sm:py-8 shadow-2xl">
						<p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.35em] text-brand-cyan/70">
							Scholar workflow
						</p>
						<h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
							Milestone completion reporting
						</h1>
						<p className="mt-3 max-w-3xl text-sm text-white/65 leading-relaxed">
							Log the work you finished, attach a GitHub link or IPFS CID, and
							send it to the validator committee without leaving the scholar
							flow.
						</p>
						<div className="mt-6 flex flex-wrap gap-2 sm:gap-3 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
							<span className="rounded-full border border-white/10 px-3 py-2">
								Wallet {address ? shortenAddress(address) : "not connected"}
							</span>
							<span className="rounded-full border border-white/10 px-3 py-2">
								Route /scholar/milestones
							</span>
						</div>
					</section>

					<div className="grid gap-8 lg:grid-cols-[1.6fr,1fr]">
						<MilestoneReportForm
							isSubmitting={isSubmitting}
							onSubmit={handleSubmit}
							initialValues={
								resubmitMilestone
									? {
											courseId: resubmitMilestone.course_id,
											milestoneId: resubmitMilestone.milestone_id.toString(),
											evidenceGithub: resubmitMilestone.evidence_github || "",
											evidenceIpfsCid:
												resubmitMilestone.evidence_ipfs_cid || "",
											evidenceDescription:
												resubmitMilestone.evidence_description || "",
											acceptedTerms: false,
										}
									: undefined
							}
						/>

						<div className="space-y-6">
							<div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 sm:p-6 shadow-xl backdrop-blur-xl">
								<Card>
									<h2 className="text-lg sm:text-xl font-black text-white">
										What to include
									</h2>
									<ul className="mt-4 space-y-3 text-xs sm:text-sm text-white/70">
										<li>
											Use the exact course ID from the server course catalog.
										</li>
										<li>Use the milestone number assigned to that course.</li>
										<li>
											Paste a GitHub PR, repo, demo link, or IPFS CID as
											evidence.
										</li>
										<li>
											Add clear milestone notes so validators can review fast.
										</li>
									</ul>
								</Card>
							</div>

							<div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 sm:p-6 shadow-xl backdrop-blur-xl">
								<Card>
									<h2 className="text-lg sm:text-xl font-black text-white">
										Latest submission
									</h2>
									{submitError ? (
										<p
											className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs sm:text-sm text-red-200"
											role="alert"
										>
											{submitError}
										</p>
									) : null}

									{submittedReport ? (
										<div className="mt-4 space-y-3 text-xs sm:text-sm text-white/70">
											<p className="flex flex-wrap gap-1">
												<span className="font-semibold text-white">
													Report ID:
												</span>{" "}
												<span className="break-all">{submittedReport.id}</span>
											</p>
											<p>
												<span className="font-semibold text-white">
													Course:
												</span>{" "}
												{submittedReport.course_id}
											</p>
											<p>
												<span className="font-semibold text-white">
													Milestone:
												</span>{" "}
												{submittedReport.milestone_id}
											</p>
											<p>
												<span className="font-semibold text-white">
													Status:
												</span>{" "}
												<span
													className={
														STATUS_COLORS[submittedReport.status] ??
														"text-white/70"
													}
												>
													{STATUS_LABELS[submittedReport.status] ??
														submittedReport.status}
												</span>
											</p>
											{submittedReport.status === "appealed" &&
												submittedReport.appeal_submitted_at && (
													<p className="text-xs text-white/40">
														Appeal submitted:{" "}
														{new Date(
															submittedReport.appeal_submitted_at,
														).toLocaleString()}
													</p>
												)}
											{submittedReport.evidence_github ? (
												<a
													href={submittedReport.evidence_github}
													target="_blank"
													rel="noreferrer"
													className="block text-brand-cyan underline text-xs sm:text-sm break-all"
												>
													Open GitHub evidence
												</a>
											) : null}
											{ipfsUrl ? (
												<a
													href={ipfsUrl}
													target="_blank"
													rel="noreferrer"
													className="block text-brand-cyan underline text-xs sm:text-sm break-all"
												>
													Open IPFS evidence
												</a>
											) : null}
										</div>
									) : (
										<p className="mt-4 text-sm text-white/60">
											No milestone report submitted in this session yet.
										</p>
									)}
								</Card>
							</div>

							<div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 sm:p-6 shadow-xl backdrop-blur-xl">
								<Card>
									<h2 className="text-lg sm:text-xl font-black text-white">
										Your Milestones
									</h2>
									{isLoadingMilestones ? (
										<p className="mt-4 text-sm text-white/60">Loading...</p>
									) : milestones.length === 0 ? (
										<p className="mt-4 text-sm text-white/60">
											No milestones submitted yet.
										</p>
									) : (
										<div className="mt-4 space-y-3">
											{milestones.map((milestone) => (
												<div
													key={milestone.id}
													className="rounded-xl border border-white/10 p-4 sm:p-3"
												>
													<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
														<div className="min-w-0">
															<p className="text-sm font-semibold text-white break-words">
																Course: {milestone.course_id}
															</p>
															<p className="text-xs text-white/60">
																Milestone #{milestone.milestone_id}
															</p>
															<div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/70">
																<span
																	className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
																		milestone.status === "approved"
																			? "bg-green-500/10 text-green-400"
																			: milestone.status === "rejected"
																				? "bg-red-500/10 text-red-400"
																				: milestone.status === "appealed"
																					? "bg-yellow-500/10 text-yellow-400"
																					: "bg-blue-500/10 text-blue-400"
																	}`}
																>
																	{milestone.status}
																</span>
																<span>
																	Resubmissions: {milestone.resubmission_count}
																</span>
															</div>
														</div>
														{milestone.status === "rejected" && (
															<button
																type="button"
																onClick={() => setResubmitMilestone(milestone)}
																className="w-full sm:w-auto min-h-[44px] rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
															>
																Resubmit
															</button>
														)}
													</div>
												</div>
											))}
										</div>
									)}
								</Card>
							</div>

							<div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 sm:p-6 shadow-xl backdrop-blur-xl">
								<Card>
									<h2 className="text-lg sm:text-xl font-black text-white">
										Next steps
									</h2>
									<p className="mt-4 text-xs sm:text-sm text-white/70 leading-relaxed">
										After submission, validators can review your evidence from
										the admin milestones queue.
									</p>
									<Link
										to="/dashboard"
										className="mt-4 inline-flex text-xs sm:text-sm font-semibold text-brand-cyan underline"
									>
										Back to dashboard
									</Link>
								</Card>
							</div>
						</div>
					</div>
				</div>
			</div>
		</ConnectWalletGuard>
	)
}
