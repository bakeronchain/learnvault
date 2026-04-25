import { Card } from "@stellar/design-system"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import ConnectWalletGuard from "../components/ConnectWalletGuard"
import MilestoneReportForm from "../components/MilestoneReportForm"
import { useWallet } from "../hooks/useWallet"
import { getIpfsUrl, isCid, normaliseCid } from "../lib/ipfs"
import {
	type MilestoneReportFormValues,
	type SubmittedMilestoneReport,
} from "../types/milestone"
import { shortenAddress } from "../util/scholarshipApplications"

const API_BASE =
	(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api"

export default function ScholarMilestones() {
	const { address } = useWallet()
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [submitError, setSubmitError] = useState<string | null>(null)
	const [submittedReport, setSubmittedReport] =
		useState<SubmittedMilestoneReport | null>(null)

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
			const response = await fetch(`${API_BASE}/milestones/submit`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					scholarAddress: address,
					courseId: values.courseId.trim(),
					milestoneId: Number(values.milestoneId),
					evidenceGithub: values.evidenceGithub.trim() || undefined,
					evidenceIpfsCid: values.evidenceIpfsCid.trim() || undefined,
					evidenceDescription: values.evidenceDescription.trim() || undefined,
				}),
			})

			const body = (await response.json().catch(() => ({}))) as {
				data?: SubmittedMilestoneReport
				error?: string
			}

			if (!response.ok || !body.data) {
				throw new Error(body.error ?? "Failed to submit milestone report.")
			}

			setSubmittedReport(body.data)
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
					<section className="glass-card rounded-[2rem] border border-white/10 px-6 py-8 shadow-2xl">
						<p className="text-xs font-black uppercase tracking-[0.35em] text-brand-cyan/70">
							Scholar workflow
						</p>
						<h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
							Milestone completion reporting
						</h1>
						<p className="mt-3 max-w-3xl text-sm text-white/65 sm:text-base">
							Log the work you finished, attach a GitHub link or IPFS CID, and
							send it to the validator committee without leaving the scholar
							flow.
						</p>
						<div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
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
						/>

						<div className="space-y-6">
							<div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl">
								<Card>
									<h2 className="text-xl font-black text-white">
										What to include
									</h2>
									<ul className="mt-4 space-y-3 text-sm text-white/70">
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

							<div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl">
								<Card>
									<h2 className="text-xl font-black text-white">
										Latest submission
									</h2>
									{submitError ? (
										<p
											className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
											role="alert"
										>
											{submitError}
										</p>
									) : null}

									{submittedReport ? (
										<div className="mt-4 space-y-3 text-sm text-white/70">
											<p>
												<span className="font-semibold text-white">
													Report ID:
												</span>{" "}
												{submittedReport.id}
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
												{submittedReport.status}
											</p>
											{submittedReport.evidence_github ? (
												<a
													href={submittedReport.evidence_github}
													target="_blank"
													rel="noreferrer"
													className="block text-brand-cyan underline"
												>
													Open GitHub evidence
												</a>
											) : null}
											{ipfsUrl ? (
												<a
													href={ipfsUrl}
													target="_blank"
													rel="noreferrer"
													className="block text-brand-cyan underline"
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

							<div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl">
								<Card>
									<h2 className="text-xl font-black text-white">Next steps</h2>
									<p className="mt-4 text-sm text-white/70">
										After submission, validators can review your evidence from
										the admin milestones queue.
									</p>
									<Link
										to="/dashboard"
										className="mt-4 inline-flex text-sm font-semibold text-brand-cyan underline"
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
