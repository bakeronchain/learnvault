import { Button } from "@stellar/design-system"
import React, { useEffect, useRef, useState } from "react"
import { useCourse } from "../hooks/useCourse"
import { useNotification } from "../hooks/useNotification"
const API_BASE =
	(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api"

interface MilestoneSubmitPanelProps {
	courseId: string
	milestoneId: number
	reportId?: number
}

const MilestoneSubmitPanel: React.FC<MilestoneSubmitPanelProps> = ({
	courseId,
	milestoneId,
	reportId,
}) => {
	const {
		submitMilestone,
		submissionStatusMap,
		isCompletingMilestone,
		getEscrowTimeout,
	} = useCourse()
	const { addNotification } = useNotification()
	const [githubUrl, setGithubUrl] = useState("")
	const [description, setDescription] = useState("")
	const hasWarnedRef = useRef(false)

	// Appeal form state
	const [showAppealForm, setShowAppealForm] = useState(false)
	const [appealReason, setAppealReason] = useState("")
	const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false)
	const [appealError, setAppealError] = useState<string | null>(null)
	const [appealSubmitted, setAppealSubmitted] = useState(false)

	const statusKey = `${courseId}-${milestoneId}`
	const status = submissionStatusMap[statusKey] || "none"
	const escrowTimeout = getEscrowTimeout(courseId)
	const daysRemaining = escrowTimeout?.daysRemaining ?? null
	const isEscrowWarning =
		daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		await submitMilestone(courseId, milestoneId, {
			github: githubUrl,
			description,
		})
	}

	const handleAppealSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!reportId || !appealReason.trim()) return

		setIsSubmittingAppeal(true)
		setAppealError(null)

		try {
			const token = localStorage.getItem("authToken") ?? ""
			const response = await fetch(
				`${API_BASE}/milestones/${reportId}/appeal`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...(token ? { Authorization: `Bearer ${token}` } : {}),
					},
					body: JSON.stringify({ reason: appealReason.trim() }),
				},
			)
			const body = (await response.json().catch(() => ({}))) as {
				error?: string
			}
			if (!response.ok) {
				throw new Error(body.error ?? "Failed to submit appeal.")
			}
			setAppealSubmitted(true)
			setShowAppealForm(false)
			addNotification("Your appeal has been submitted for review.", "success")
		} catch (err) {
			setAppealError(
				err instanceof Error ? err.message : "Failed to submit appeal.",
			)
		} finally {
			setIsSubmittingAppeal(false)
		}
	}

	useEffect(() => {
		if (isEscrowWarning && !hasWarnedRef.current) {
			addNotification(
				`Escrow timeout warning: ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`,
				"warning",
			)
			hasWarnedRef.current = true
		}
	}, [addNotification, daysRemaining, isEscrowWarning])

	if (status === "pending") {
		return (
			<div className="p-8 rounded-[2rem] border border-brand-cyan/30 bg-brand-cyan/5 text-center">
				<div className="w-16 h-16 mx-auto bg-brand-cyan/20 rounded-full flex items-center justify-center mb-4">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						strokeWidth={1.5}
						stroke="currentColor"
						className="w-8 h-8 text-brand-cyan animate-pulse"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<h3 className="text-xl font-bold text-white mb-2">
					Submission Received
				</h3>
				<p className="text-white/60">
					Your milestone evidence has been submitted and is currently{" "}
					<span className="text-brand-cyan font-semibold">
						awaiting admin review
					</span>
					. You'll be notified once it's verified.
				</p>
			</div>
		)
	}

	if (status === "verified") {
		return (
			<div className="p-8 rounded-[2rem] border border-green-500/30 bg-green-500/5 text-center">
				<div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-4">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						strokeWidth={1.5}
						stroke="currentColor"
						className="w-8 h-8 text-green-500"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<h3 className="text-xl font-bold text-white mb-2">
					Milestone Verified
				</h3>
				<p className="text-white/60">
					Congratulations! Your work has been reviewed and verified by the
					committee.
				</p>
			</div>
		)
	}

	if (status === "rejected") {
		if (appealSubmitted) {
			return (
				<div className="p-8 rounded-[2rem] border border-yellow-500/30 bg-yellow-500/5 text-center">
					<h3 className="text-xl font-bold text-white mb-2">
						Appeal Submitted
					</h3>
					<p className="text-white/60">
						Your appeal is under review by a second-tier validator. You'll be
						notified of the outcome.
					</p>
				</div>
			)
		}

		return (
			<div className="p-8 rounded-[2rem] border border-red-500/30 bg-red-500/5">
				<div className="flex items-center gap-3 mb-4">
					<div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center shrink-0">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							strokeWidth={1.5}
							stroke="currentColor"
							className="w-5 h-5 text-red-400"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</div>
					<h3 className="text-xl font-bold text-white">Milestone Rejected</h3>
				</div>
				<p className="text-white/60 text-sm mb-6">
					Your milestone submission was rejected. If you believe this decision
					was incorrect, you can file a formal appeal for second-tier review.
				</p>

				{!showAppealForm ? (
					<Button
						variant="secondary"
						size="sm"
						onClick={() => setShowAppealForm(true)}
					>
						File an Appeal
					</Button>
				) : (
					<form onSubmit={handleAppealSubmit} className="space-y-4">
						<div className="space-y-2">
							<label className="text-sm font-semibold text-white/80">
								Appeal Reason
							</label>
							<textarea
								placeholder="Explain why you believe the rejection was incorrect and provide any additional context..."
								value={appealReason}
								onChange={(e) => setAppealReason(e.target.value)}
								rows={5}
								maxLength={2000}
								className="w-full px-5 py-4 rounded-2xl bg-black/40 border border-white/10 text-white placeholder:text-white/20 outline-none focus:border-yellow-400/50 transition-all duration-300 resize-none"
							/>
							<p className="text-xs text-white/40 text-right">
								{appealReason.length}/2000
							</p>
						</div>

						{appealError && (
							<p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
								{appealError}
							</p>
						)}

						<div className="flex gap-3">
							<Button
								type="submit"
								variant="primary"
								size="sm"
								disabled={isSubmittingAppeal || !appealReason.trim()}
							>
								{isSubmittingAppeal ? "Submitting…" : "Submit Appeal"}
							</Button>
							<Button
								type="button"
								variant="secondary"
								size="sm"
								onClick={() => {
									setShowAppealForm(false)
									setAppealError(null)
								}}
							>
								Cancel
							</Button>
						</div>
					</form>
				)}
			</div>
		)
	}

	if (status === "appealed") {
		return (
			<div className="p-8 rounded-[2rem] border border-yellow-500/30 bg-yellow-500/5 text-center">
				<div className="w-16 h-16 mx-auto bg-yellow-500/20 rounded-full flex items-center justify-center mb-4">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						strokeWidth={1.5}
						stroke="currentColor"
						className="w-8 h-8 text-yellow-400 animate-pulse"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
						/>
					</svg>
				</div>
				<h3 className="text-xl font-bold text-white mb-2">
					Appeal Under Review
				</h3>
				<p className="text-white/60">
					Your appeal is being reviewed by a second-tier validator. You'll be
					notified once a decision is made.
				</p>
			</div>
		)
	}

	if (status === "final_rejected") {
		return (
			<div className="p-8 rounded-[2rem] border border-red-700/40 bg-red-900/10 text-center">
				<h3 className="text-xl font-bold text-white mb-2">
					Appeal Final Decision: Rejected
				</h3>
				<p className="text-white/60">
					Your appeal has been reviewed and the original rejection has been
					upheld. This decision is final.
				</p>
			</div>
		)
	}

	return (
		<div className="p-8 rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl">
			<div className="mb-6">
				<h3 className="text-2xl font-bold text-white mb-2">
					Submit Milestone Evidence
				</h3>
				<p className="text-white/60 text-sm">
					Provide a GitHub repository link or a brief description of your work
					to complete this milestone.
				</p>
			</div>

			<form onSubmit={handleSubmit} className="space-y-6">
				{daysRemaining !== null && daysRemaining >= 0 && (
					<div
						className={`rounded-2xl border px-4 py-3 text-sm ${
							isEscrowWarning
								? "border-orange-500/40 bg-orange-500/10 text-orange-100"
								: "border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan"
						}`}
					>
						Escrow timeout window: <strong>{daysRemaining}</strong> day
						{daysRemaining === 1 ? "" : "s"} remaining
					</div>
				)}

				<div className="space-y-2">
					<label className="text-sm font-semibold text-white/80 ml-1">
						GitHub Evidence Link
					</label>
					<input
						type="url"
						placeholder="https://github.com/your-username/your-repo"
						value={githubUrl}
						onChange={(e) => setGithubUrl(e.target.value)}
						className="w-full px-5 py-4 rounded-2xl bg-black/40 border border-white/10 text-white placeholder:text-white/20 outline-none focus:border-brand-cyan/50 transition-all duration-300"
					/>
				</div>

				<div className="space-y-2">
					<label className="text-sm font-semibold text-white/80 ml-1">
						Work Description
					</label>
					<textarea
						placeholder="Briefly describe what you built or achieved..."
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						rows={4}
						className="w-full px-5 py-4 rounded-2xl bg-black/40 border border-white/10 text-white placeholder:text-white/20 outline-none focus:border-brand-cyan/50 transition-all duration-300 resize-none"
					/>
				</div>

				<div className="pt-2">
					<Button
						type="submit"
						variant="primary"
						size="md"
						className="w-full py-6 rounded-2xl font-bold text-lg tracking-wide hover:shadow-[0_0_20px_rgba(0,195,255,0.3)] transition-all duration-300"
						disabled={isCompletingMilestone || (!githubUrl && !description)}
					>
						{isCompletingMilestone ? (
							<span className="flex items-center gap-2">
								<svg
									className="animate-spin h-5 w-5 text-white"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
								>
									<circle
										className="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										strokeWidth="4"
									></circle>
									<path
										className="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									></path>
								</svg>
								Submitting...
							</span>
						) : (
							"Submit Milestone"
						)}
					</Button>
				</div>
			</form>
		</div>
	)
}

export default MilestoneSubmitPanel
