import React, { useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"
import { useNavigate } from "react-router-dom"
import { useToast } from "../components/Toast/ToastProvider"
import { WalletButton } from "../components/WalletButton"
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

interface FormErrors {
	title?: string
	description?: string
	applicationUrl?: string
	fundingAmount?: string
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

const isValidUrl = (value: string): boolean => {
	if (!value) return true
	try {
		const url = new URL(value)
		return url.protocol === "http:" || url.protocol === "https:"
	} catch {
		return false
	}
}

const isNonEmpty = (value: string): boolean => value.trim().length > 0

const DaoPropose: React.FC = () => {
	const { address } = useWallet()
	const navigate = useNavigate()
	const {
		createProposal,
		isSubmittingProposal,
		votingPower,
		isLoadingVotingPower,
		isVotingPowerError,
	} = useProposals()
	const { showError } = useToast()
	const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit")
	const [submissionError, setSubmissionError] = useState<string | null>(null)
	const [formErrors, setFormErrors] = useState<FormErrors>({})
	const [createdProposalId, setCreatedProposalId] = useState<number | null>(
		null,
	)
	const [createdTxHash, setCreatedTxHash] = useState<string | null>(null)
	const [formData, setFormData] = useState<FormData>(initialFormData)

	// Allow form access while loading or when the voting power API is unreachable
	const hasMinimumBalance =
		isLoadingVotingPower ||
		isVotingPowerError ||
		votingPower >= MINIMUM_PROPOSAL_TOKENS

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

	const validateForm = (): FormErrors => {
		const errors: FormErrors = {}

		if (!isNonEmpty(formData.title)) {
			errors.title = "Proposal title is required."
		}

		if (!isNonEmpty(formData.description)) {
			errors.description = "Proposal description is required."
		}

		if (formData.type === "scholarship" && formData.applicationUrl.trim()) {
			if (!isValidUrl(formData.applicationUrl.trim())) {
				errors.applicationUrl =
					"Please enter a valid URL starting with http:// or https://"
			}
		}

		if (formData.type === "scholarship" && formData.fundingAmount.trim()) {
			const amount = Number(formData.fundingAmount)
			if (isNaN(amount) || amount < 0) {
				errors.fundingAmount = "Funding amount must be a positive number."
			}
		}

		return errors
	}

	const fieldErrorId = (name: string): string => `${name}-error`
	const ariaDescribedBy = (name: string): string | undefined =>
		formErrors[name as keyof FormErrors] ? fieldErrorId(name) : undefined

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
		if (name in formErrors) {
			setFormErrors((current) => {
				const next = { ...current }
				delete next[name as keyof FormErrors]
				return next
			})
		}
		if (submissionError) setSubmissionError(null)
	}

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!address || !hasMinimumBalance) return

		const errors = validateForm()
		if (Object.keys(errors).length > 0) {
			setFormErrors(errors)
			return
		}

		setSubmissionError(null)

		try {
			const created = await createProposal({
				author_address: address,
				title: formData.title.trim(),
				description: composedDescription,
				requested_amount: requestedAmount,
				evidence_url: evidenceUrl,
			})

			setCreatedProposalId(created.proposal_id)
			setCreatedTxHash(created.tx_hash ?? null)
			setFormData(initialFormData)
			setFormErrors({})
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

	const handleCreateAnother = () => {
		setCreatedProposalId(null)
		setCreatedTxHash(null)
		setSubmissionError(null)
		setFormErrors({})
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
								aria-invalid={Boolean(formErrors.applicationUrl)}
								aria-describedby={ariaDescribedBy("applicationUrl")}
								className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-white/40 focus:border-brand-cyan/40 focus:outline-none transition-colors ${
									formErrors.applicationUrl
										? "border-red-400"
										: "border-white/10"
								}`}
								placeholder="https://example.com/scholarship-application"
							/>
							{formErrors.applicationUrl && (
								<p
									id={fieldErrorId("applicationUrl")}
									className="text-sm text-red-400 mt-1"
									role="alert"
								>
									{formErrors.applicationUrl}
								</p>
							)}
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
								aria-invalid={Boolean(formErrors.fundingAmount)}
								aria-describedby={ariaDescribedBy("fundingAmount")}
								className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-white/40 focus:border-brand-cyan/40 focus:outline-none transition-colors ${
									formErrors.fundingAmount
										? "border-red-400"
										: "border-white/10"
								}`}
								placeholder="500"
								min="0"
							/>
							{formErrors.fundingAmount && (
								<p
									id={fieldErrorId("fundingAmount")}
									className="text-sm text-red-400 mt-1"
									role="alert"
								>
									{formErrors.fundingAmount}
								</p>
							)}
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

	if (createdProposalId !== null) {
		return (
			<div className="min-h-screen flex items-center justify-center text-white">
				<div className="glass-card p-12 rounded-[3rem] border border-white/5 text-center max-w-lg w-full">
					<div className="w-16 h-16 mx-auto mb-6 rounded-full bg-brand-emerald/20 flex items-center justify-center">
						<span className="text-3xl">✓</span>
					</div>
					<h1 className="text-4xl font-black mb-4">Proposal Submitted!</h1>
					<p className="text-white/60 mb-8">
						Your proposal has been submitted for community review and voting.
					</p>
					<div className="space-y-3 mb-8">
						<div className="p-4 rounded-xl bg-white/5 border border-white/10">
							<span className="text-xs font-black uppercase tracking-widest text-white/30 block mb-1">
								Proposal ID
							</span>
							<strong className="text-brand-cyan text-lg">
								{createdProposalId}
							</strong>
						</div>
						{createdTxHash && (
							<div className="p-4 rounded-xl bg-white/5 border border-white/10">
								<span className="text-xs font-black uppercase tracking-widest text-white/30 block mb-1">
									Transaction Hash
								</span>
								<code className="text-sm text-white/70 break-all">
									{createdTxHash}
								</code>
							</div>
						)}
					</div>
					<div className="flex flex-col gap-3">
						<button
							onClick={() =>
								navigate(`/dao/proposals?proposal=${createdProposalId}`)
							}
							className="w-full px-6 py-3 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all"
						>
							View Proposal
						</button>
						<button
							onClick={handleCreateAnother}
							className="w-full px-6 py-3 bg-white/5 border border-white/10 text-white/60 font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all"
						>
							Create Another Proposal
						</button>
					</div>
				</div>
			</div>
		)
	}

	if (!address) {
		return (
			<div className="flex items-center justify-center py-32 text-white">
				<div className="glass-card p-12 rounded-3xl border border-white/8 text-center max-w-md w-full flex flex-col items-center gap-6">
					<span className="text-5xl">🔐</span>
					<div>
						<h1 className="text-2xl font-black mb-2">Connect Your Wallet</h1>
						<p className="text-white/50 text-sm leading-relaxed">
							You need to connect your wallet to create a governance proposal.
						</p>
					</div>
					<WalletButton />
				</div>
			</div>
		)
	}

	if (!isLoadingVotingPower && !isVotingPowerError && !hasMinimumBalance) {
		return (
			<div className="flex items-center justify-center py-32 text-white">
				<div className="glass-card p-12 rounded-3xl border border-white/8 text-center max-w-md w-full flex flex-col items-center gap-6">
					<span className="text-5xl">⚖️</span>
					<div>
						<h1 className="text-2xl font-black mb-2">
							Insufficient Governance Tokens
						</h1>
						<p className="text-white/50 text-sm leading-relaxed mb-4">
							You need at least{" "}
							<span className="text-brand-cyan font-bold">
								{MINIMUM_PROPOSAL_TOKENS.toString()} GOV
							</span>{" "}
							to create a proposal. Complete courses to earn LRN and governance
							tokens.
						</p>
						<p className="text-sm text-white/30">
							Your balance:{" "}
							<span className="text-white/60 font-bold">
								{votingPower.toString()} GOV
							</span>
						</p>
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

				<form onSubmit={handleSubmit} className="space-y-8" noValidate>
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
									Proposal Title <span className="text-red-400">*</span>
								</label>
								<input
									type="text"
									name="title"
									value={formData.title}
									onChange={handleInputChange}
									maxLength={100}
									required
									aria-required="true"
									aria-invalid={Boolean(formErrors.title)}
									aria-describedby={ariaDescribedBy("title")}
									className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-white/40 focus:border-brand-cyan/40 focus:outline-none transition-colors ${
										formErrors.title ? "border-red-400" : "border-white/10"
									}`}
									placeholder="Enter proposal title"
								/>
								<div className="flex justify-between items-center mt-1">
									{formErrors.title ? (
										<p
											id={fieldErrorId("title")}
											className="text-sm text-red-400"
											role="alert"
										>
											{formErrors.title}
										</p>
									) : (
										<span />
									)}
									<span
										className={`text-xs ${
											formData.title.length > 90
												? "text-yellow-400"
												: "text-white/40"
										}`}
									>
										{formData.title.length}/100
									</span>
								</div>
							</div>

							<div>
								<div className="flex justify-between items-center mb-2">
									<label className="block text-sm font-black uppercase tracking-widest text-white/30">
										Proposal Description <span className="text-red-400">*</span>
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
											aria-required="true"
											aria-invalid={Boolean(formErrors.description)}
											aria-describedby={ariaDescribedBy("description")}
											rows={8}
											className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-white/40 focus:border-brand-cyan/40 focus:outline-none transition-colors resize-none ${
												formErrors.description
													? "border-red-400"
													: "border-white/10"
											}`}
											placeholder="Enter the proposal details using Markdown formatting"
										/>
										<div className="flex justify-between items-center mt-1">
											{formErrors.description ? (
												<p
													id={fieldErrorId("description")}
													className="text-sm text-red-400"
													role="alert"
												>
													{formErrors.description}
												</p>
											) : (
												<span />
											)}
											<span
												className={`text-xs ${
													formData.description.length > 1900
														? "text-yellow-400"
														: "text-white/40"
												}`}
											>
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
						{submissionError && (
							<p className="text-sm text-red-400" role="alert">
								{submissionError}
							</p>
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
									isSubmittingProposal
								}
								className="px-8 py-3 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan font-black uppercase tracking-widest rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
							>
								{isSubmittingProposal ? (
									<>
										<span className="w-4 h-4 border-2 border-brand-cyan/30 border-t-brand-cyan rounded-full animate-spin" />
										Submitting...
									</>
								) : (
									"Submit Proposal"
								)}
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	)
}

export default DaoPropose
