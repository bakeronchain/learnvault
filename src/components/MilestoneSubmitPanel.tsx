import { Button } from "@stellar/design-system"
import React, { useEffect, useRef, useState } from "react"
import { useCourse } from "../hooks/useCourse"
import { useNotification } from "../hooks/useNotification"

interface MilestoneSubmitPanelProps {
	courseId: string
	milestoneId: number
}

const MilestoneSubmitPanel: React.FC<MilestoneSubmitPanelProps> = ({
	courseId,
	milestoneId,
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
