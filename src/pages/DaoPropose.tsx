import React, { useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"
import { useNavigate } from "react-router-dom"
import { useToast } from "../components/Toast/ToastProvider"
import { useProposals } from "../hooks/useProposals"
import { useWallet } from "../hooks/useWallet"

type ProposalType = "scholarship" | "parameter_change" | "new_course"

interface FormData {
	title: string
	description: string
	type: ProposalType
	applicationUrl: string
	fundingAmount: string
	parameterName: string
	parameterValue: string
	parameterReason: string
	courseTitle: string
	courseDescription: string
	courseDuration: string
	courseDifficulty: string
}

const MINIMUM_PROPOSAL_TOKENS = 10n

const initialFormData: FormData = {
	title: "",
	description: "",
	type: "scholarship",
	applicationUrl: "",
	fundingAmount: "",
	parameterName: "",
	parameterValue: "",
	parameterReason: "",
	courseTitle: "",
	courseDescription: "",
	courseDuration: "",
	courseDifficulty: "",
}

const DaoPropose: React.FC = () => {
	const { address } = useWallet()
	const navigate = useNavigate()
	const { createProposal, isSubmittingProposal, votingPower } = useProposals()
	const { showError } = useToast()
	const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit")
	const [submissionError, setSubmissionError] = useState<string | null>(null)
	const [submissionSuccess, setSubmissionSuccess] = useState<string | null>(
		null,
	)
	const [formData, setFormData] = useState<FormData>(initialFormData)

	const hasMinimumBalance = votingPower >= MINIMUM_PROPOSAL_TOKENS

	const requestedAmount = useMemo(() => {
		if (formData.type === "scholarship" && formData.fundingAmount.trim()) {
			return formData.fundingAmount.trim()
		}
		return "0"
	}, [formData.fundingAmount, formData.type])

	const evidenceUrl = useMemo(() => {
		const candidate = formData.applicationUrl.trim()
		if (candidate.length > 0) return candidate
		if (typeof window !== "undefined") {
			return `${window.location.origin}/dao/proposals`
		}
		return "https://learnvault.app/dao/proposals"
	}, [formData.applicationUrl])

	const composedDescription = useMemo(() => {
		const sections = [formData.description.trim()]

		if (formData.type === "parameter_change") {
			sections.push(
				[
					"## Parameter Change Details",
					`- Parameter: ${formData.parameterName || "Not specified"}`,
					`- New value: ${formData.parameterValue || "Not specified"}`,
					`- Reason: ${formData.parameterReason || "Not specified"}`,
				].join("\n"),
			)
		}

		if (formData.type === "new_course") {
			sections.push(
				[
					"## Course Proposal Details",
					`- Course title: ${formData.courseTitle || "Not specified"}`,
					`- Course description: ${formData.courseDescription || "Not specified"}`,
					`- Duration (hours): ${formData.courseDuration || "Not specified"}`,
					`- Difficulty: ${formData.courseDifficulty || "Not specified"}`,
				].join("\n"),
			)
		}

		if (formData.type === "scholarship") {
			sections.push(
				[
					"## Scholarship Request Details",
					`- Application URL: ${evidenceUrl}`,
					`- Requested funding: ${requestedAmount} USDC`,
				].join("\n"),
			)
		}

		return sections.filter(Boolean).join("\n\n")
	}, [evidenceUrl, formData, requestedAmount])

	const handleInputChange = (
		event: React.ChangeEvent<
			HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
		>,
	) => {
		const { name, value } = event.target
		setFormData((current) => ({
			...current,
			[name]: value,
		}))
		if (submissionError) setSubmissionError(null)
		if (submissionSuccess) setSubmissionSuccess(null)
	}

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!address || !hasMinimumBalance) return

		setSubmissionError(null)
		setSubmissionSuccess(null)

		try {
			const created = await createProposal({
				author_address: address,
				title: formData.title.trim(),
				description: composedDescription,
				requested_amount: requestedAmount,
				evidence_url: evidenceUrl,
			})

			setSubmissionSuccess("Proposal submitted successfully. Redirecting...")
			setFormData(initialFormData)
			window.setTimeout(() => {
				void navigate(`/dao/proposals?proposal=${created.proposal_id}`)
			}, 700)
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to submit proposal. Please try again."
			setSubmissionError(message)
			console.error("Failed to submit proposal:", error)
			showError(message)
		}
	}

	const renderTypeSpecificFields = () => {
		switch (formData.type) {
			case "scholarship":
				return (
					<div className="space-y-6">
						<div>
							<label className="block text-sm font-black uppercase tracking-widest text-white/30 mb-2">
								Application URL
							</label>
							<input
								type="url"
								name="applicationUrl"
								value={formData.applicationUrl}
								onChange={handleInputChange}
								className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-brand-cyan/40 focus:outline-none transition-colors"
								placeholder="https://example.com/scholarship-application"
							/>
						</div>
						<div>
							<label className="block text-sm font-black uppercase tracking-widest text-white/30 mb-2">
								Funding Amount (USDC)
							</label>
							<input
								type="number"
								name="fundingAmount"
								value={formData.fundingAmount}
								onChange={handleInputChange}
								className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-brand-cyan/40 focus:outline-none transition-colors"
								placeholder="500"
								min="0"
							/>
						</div>
					</div>
				)
			case "parameter_change":
				return (
					<div className="space-y-6">
						<div>
							<label className="block text-sm font-black uppercase tracking-widest text-white/30 mb-2">
								Parameter Name
							</label>
							<select
								name="parameterName"
								value={formData.parameterName}
								onChange={handleInputChange}
								className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-brand-cyan/40 focus:outline-none transition-colors"
							>
								<option value="">Select a parameter</option>
								<option value="quorum">Quorum</option>
								<option value="threshold">Threshold</option>
								<option value="min_lrn">Minimum LRN to Apply</option>
							</select>
						</div>
						<div>
							<label className="block text-sm font-black uppercase tracking-widest text-white/30 mb-2">
								New Value
							</label>
							<input
								type="text"
								name="parameterValue"
								value={formData.parameterValue}
								onChange={handleInputChange}
								className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-brand-cyan/40 focus:outline-none transition-colors"
								placeholder="Enter new value"
							/>
						</div>
						<div>
							<label className="block text-sm font-black uppercase tracking-widest text-white/30 mb-2">
								Reason for Change
							</label>
							<textarea
								name="parameterReason"
								value={formData.parameterReason}
								onChange={handleInputChange}
								rows={3}
								className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-brand-cyan/40 focus:outline-none transition-colors resize-none"
								placeholder="Explain why this parameter should be changed"
							/>
						</div>
					</div>
				)
			case "new_course":
				return (
					<div className="space-y-6">
						<div>
							<label className="block text-sm font-black uppercase tracking-widest text-white/30 mb-2">
								Course Title
							</label>
							<input
								type="text"
								name="courseTitle"
								value={formData.courseTitle}
								onChange={handleInputChange}
								className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-brand-cyan/40 focus:outline-none transition-colors"
								placeholder="Introduction to Smart Contracts"
							/>
						</div>
						<div>
							<label className="block text-sm font-black uppercase tracking-widest text-white/30 mb-2">
								Course Description
							</label>
							<textarea
								name="courseDescription"
								value={formData.courseDescription}
								onChange={handleInputChange}
								rows={3}
								className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-brand-cyan/40 focus:outline-none transition-colors resize-none"
								placeholder="Detailed description of the course content and objectives"
							/>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div>
								<label className="block text-sm font-black uppercase tracking-widest text-white/30 mb-2">
									Duration (hours)
								</label>
								<input
									type="number"
									name="courseDuration"
									value={formData.courseDuration}
									onChange={handleInputChange}
									className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-brand-cyan/40 focus:outline-none transition-colors"
									placeholder="40"
									min="1"
								/>
							</div>
							<div>
								<label className="block text-sm font-black uppercase tracking-widest text-white/30 mb-2">
									Difficulty
								</label>
								<select
									name="courseDifficulty"
									value={formData.courseDifficulty}
									onChange={handleInputChange}
									className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-brand-cyan/40 focus:outline-none transition-colors"
								>
									<option value="">Select difficulty</option>
									<option value="beginner">Beginner</option>
									<option value="intermediate">Intermediate</option>
									<option value="advanced">Advanced</option>
								</select>
							</div>
						</div>
					</div>
				)
		}
	}

	const renderMarkdownPreview = () => (
		<div className="prose prose-invert max-w-none">
			<ReactMarkdown>
				{composedDescription || "*Start typing to see a preview...*"}
			</ReactMarkdown>
		</div>
	)

	if (!address) {
		return (
			<div className="min-h-screen flex items-center justify-center text-white">
				<div className="text-center">
					<h1 className="text-4xl font-black mb-4">Connect Your Wallet</h1>
					<p className="text-white/60 mb-8">
						You need to connect your wallet to create a proposal.
					</p>
				</div>
			</div>
		)
	}

	if (!hasMinimumBalance) {
		return (
			<div className="min-h-screen flex items-center justify-center text-white">
				<div className="glass-card p-12 rounded-[3rem] border border-white/5 text-center max-w-md">
					<h1 className="text-4xl font-black mb-4">
						Insufficient Governance Tokens
					</h1>
					<p className="text-white/60 mb-6">
						You need at least {MINIMUM_PROPOSAL_TOKENS.toString()} governance
						tokens to create a proposal.
					</p>
					<div className="text-brand-cyan text-2xl font-bold mb-8">
						Current Balance: {votingPower.toString()} GOV
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="min-h-screen text-white">
			<div className="p-12 max-w-4xl mx-auto">
				<header className="mb-12">
					<h1 className="text-6xl font-black mb-4 tracking-tighter text-gradient">
						Create Proposal
					</h1>
					<p className="text-white/40 text-lg font-medium max-w-2xl">
						Submit a governance proposal to the backend API for community review
						and voting.
					</p>
				</header>

				<form onSubmit={handleSubmit} className="space-y-8">
					<div className="glass-card p-8 rounded-[2.5rem] border border-white/5">
						<div className="space-y-6">
							<div>
								<label className="block text-sm font-black uppercase tracking-widest text-white/30 mb-2">
									Proposal Type
								</label>
								<select
									name="type"
									value={formData.type}
									onChange={handleInputChange}
									className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-brand-cyan/40 focus:outline-none transition-colors"
								>
									<option value="scholarship">Scholarship</option>
									<option value="parameter_change">Parameter Change</option>
									<option value="new_course">New Course Track</option>
								</select>
							</div>

							<div>
								<label className="block text-sm font-black uppercase tracking-widest text-white/30 mb-2">
									Title (max 100 characters)
								</label>
								<input
									type="text"
									name="title"
									value={formData.title}
									onChange={handleInputChange}
									maxLength={100}
									required
									className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-brand-cyan/40 focus:outline-none transition-colors"
									placeholder="Enter proposal title"
								/>
								<div className="text-right mt-1">
									<span className="text-xs text-white/40">
										{formData.title.length}/100
									</span>
								</div>
							</div>

							<div>
								<div className="flex justify-between items-center mb-2">
									<label className="block text-sm font-black uppercase tracking-widest text-white/30">
										Description (max 2000 characters)
									</label>
									<div className="flex gap-2">
										<button
											type="button"
											onClick={() => setActiveTab("edit")}
											className={`px-3 py-1 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
												activeTab === "edit"
													? "bg-brand-cyan/20 text-brand-cyan"
													: "text-white/40 hover:text-white/60"
											}`}
										>
											Edit
										</button>
										<button
											type="button"
											onClick={() => setActiveTab("preview")}
											className={`px-3 py-1 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
												activeTab === "preview"
													? "bg-brand-cyan/20 text-brand-cyan"
													: "text-white/40 hover:text-white/60"
											}`}
										>
											Preview
										</button>
									</div>
								</div>
								{activeTab === "edit" ? (
									<div>
										<textarea
											name="description"
											value={formData.description}
											onChange={handleInputChange}
											maxLength={2000}
											required
											rows={8}
											className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-brand-cyan/40 focus:outline-none transition-colors resize-none"
											placeholder="Enter the proposal details using Markdown formatting"
										/>
										<div className="text-right mt-1">
											<span className="text-xs text-white/40">
												{formData.description.length}/2000
											</span>
										</div>
									</div>
								) : (
									<div className="min-h-[200px] p-4 bg-white/5 border border-white/10 rounded-xl">
										{renderMarkdownPreview()}
									</div>
								)}
							</div>
						</div>
					</div>

					<div className="glass-card p-8 rounded-[2.5rem] border border-white/5">
						<h2 className="text-2xl font-black mb-6 tracking-tight">
							{formData.type === "scholarship" && "Scholarship Details"}
							{formData.type === "parameter_change" &&
								"Parameter Change Details"}
							{formData.type === "new_course" && "Course Details"}
						</h2>
						{renderTypeSpecificFields()}
					</div>

					<div className="glass-card p-6 rounded-[2rem] border border-white/5 space-y-3">
						<p className="text-sm text-white/50">
							Submitting as <span className="text-white">{address}</span>
						</p>
						<p className="text-sm text-white/50">
							Requested amount:{" "}
							<span className="text-brand-cyan">{requestedAmount} USDC</span>
						</p>
						{submissionSuccess && (
							<p className="text-sm text-brand-emerald">{submissionSuccess}</p>
						)}
						{submissionError && (
							<p className="text-sm text-red-400">{submissionError}</p>
						)}
					</div>

					<div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
						<div className="text-sm text-white/40">
							Your governance token balance:{" "}
							<span className="text-brand-cyan font-bold">
								{votingPower.toString()} GOV
							</span>
						</div>
						<div className="flex gap-4">
							<button
								type="button"
								onClick={() => navigate("/dao")}
								className="px-8 py-3 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all"
							>
								Cancel
							</button>
							<button
								type="submit"
								data-testid="submit-proposal"
								disabled={
									isSubmittingProposal ||
									!formData.title.trim() ||
									!formData.description.trim() ||
									!hasMinimumBalance
								}
								className="px-8 py-3 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan font-black uppercase tracking-widest rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all"
							>
								{isSubmittingProposal ? "Submitting..." : "Submit Proposal"}
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	)
}

export default DaoPropose
