import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useWallet } from "../hooks/useWallet"
import { useScholarshipTreasury } from "../util/scholarshipTreasury"
import ReactMarkdown from "react-markdown"

type ProposalType = "scholarship" | "parameter_change" | "new_course"

interface FormData {
	title: string
	description: string
	type: ProposalType
	// Scholarship specific fields
	applicationUrl?: string
	fundingAmount?: string
	// Parameter change specific fields
	parameterName?: string
	parameterValue?: string
	parameterReason?: string
	// New course specific fields
	courseTitle?: string
	courseDescription?: string
	courseDuration?: string
	courseDifficulty?: string
}

const DaoPropose: React.FC = () => {
	const { address } = useWallet()
	const navigate = useNavigate()
	const { createProposal, getGovernanceTokenBalance, getMinimumProposalTokens, isConnected } = useScholarshipTreasury()
	const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit")
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [governanceTokenBalance, setGovernanceTokenBalance] = useState(0)
	const [minimumTokens, setMinimumTokens] = useState(10)
	const [hasMinimumBalance, setHasMinimumBalance] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	const [formData, setFormData] = useState<FormData>({
		title: "",
		description: "",
		type: "scholarship",
	})

	// Check governance token balance and minimum requirements
	useEffect(() => {
		const checkBalance = async () => {
			if (!address || !isConnected) return

			setIsLoading(true)
			try {
				const [balance, minimum] = await Promise.all([
					getGovernanceTokenBalance(address),
					getMinimumProposalTokens()
				])
				
				setGovernanceTokenBalance(balance)
				setMinimumTokens(minimum)
				setHasMinimumBalance(balance >= minimum)
			} catch (error) {
				console.error("Failed to check governance token balance:", error)
				// Set default values on error
				setGovernanceTokenBalance(0)
				setMinimumTokens(10)
				setHasMinimumBalance(false)
			} finally {
				setIsLoading(false)
			}
		}

		checkBalance()
	}, [address, isConnected, getGovernanceTokenBalance, getMinimumProposalTokens])

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
	) => {
		const { name, value } = e.target
		setFormData(prev => ({
			...prev,
			[name]: value,
		}))
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!hasMinimumBalance || !address) return

		setIsSubmitting(true)

		try {
			// Prepare proposal data for contract submission
			const proposalData = {
				title: formData.title,
				description: formData.description,
				proposalType: formData.type,
				typeSpecificData: {
					applicationUrl: formData.applicationUrl,
					fundingAmount: formData.fundingAmount ? parseFloat(formData.fundingAmount) : undefined,
					parameterName: formData.parameterName,
					parameterValue: formData.parameterValue,
					parameterReason: formData.parameterReason,
					courseTitle: formData.courseTitle,
					courseDescription: formData.courseDescription,
					courseDuration: formData.courseDuration ? parseInt(formData.courseDuration) : undefined,
					courseDifficulty: formData.courseDifficulty,
				}
			}

			// Submit to ScholarshipTreasury contract
			const txHash = await createProposal(proposalData)
			
			// Extract proposal ID from transaction hash (mock implementation)
			const proposalId = txHash.includes('PROPOSAL_') 
				? txHash.split('_')[1] 
				: Math.floor(Math.random() * 1000) + 1
			
			// Redirect to proposal detail page
			navigate(`/dao/proposals#proposal-${proposalId}`)
		} catch (error) {
			console.error("Failed to submit proposal:", error)
			// In a real implementation, you would show an error message to the user
			alert("Failed to submit proposal. Please try again.")
		} finally {
			setIsSubmitting(false)
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
								value={formData.applicationUrl || ""}
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
								value={formData.fundingAmount || ""}
								onChange={handleInputChange}
								className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-brand-cyan/40 focus:outline-none transition-colors"
								placeholder="500"
								min="1"
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
								value={formData.parameterName || ""}
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
								value={formData.parameterValue || ""}
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
								value={formData.parameterReason || ""}
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
								value={formData.courseTitle || ""}
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
								value={formData.courseDescription || ""}
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
									value={formData.courseDuration || ""}
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
									value={formData.courseDifficulty || ""}
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
			default:
				return null
		}
	}

	const renderMarkdownPreview = () => {
		return (
			<div className="prose prose-invert max-w-none">
				{formData.title && (
					<h1 className="text-3xl font-bold text-white mb-4">{formData.title}</h1>
				)}
				<ReactMarkdown 
					className="text-white/80"
					components={{
						h1: ({children}) => <h1 className="text-2xl font-bold text-white mb-4">{children}</h1>,
						h2: ({children}) => <h2 className="text-xl font-bold text-white mb-3">{children}</h2>,
						h3: ({children}) => <h3 className="text-lg font-bold text-white mb-2">{children}</h3>,
						p: ({children}) => <p className="text-white/80 leading-relaxed mb-4">{children}</p>,
						ul: ({children}) => <ul className="list-disc list-inside text-white/80 mb-4">{children}</ul>,
						ol: ({children}) => <ol className="list-decimal list-inside text-white/80 mb-4">{children}</ol>,
						li: ({children}) => <li className="text-white/80 mb-2">{children}</li>,
						strong: ({children}) => <strong className="text-white font-bold">{children}</strong>,
						em: ({children}) => <em className="text-white italic">{children}</em>,
						code: ({children}) => <code className="bg-white/10 text-brand-cyan px-2 py-1 rounded text-sm">{children}</code>,
						pre: ({children}) => <pre className="bg-white/10 text-white p-4 rounded-lg overflow-x-auto mb-4">{children}</pre>,
						blockquote: ({children}) => <blockquote className="border-l-4 border-brand-cyan pl-4 text-white/60 italic mb-4">{children}</blockquote>,
						a: ({children, href}) => <a href={href} className="text-brand-cyan hover:text-brand-cyan/80 underline">{children}</a>,
					}}
				>
					{formData.description || "*Start typing to see a preview...*"}
				</ReactMarkdown>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center text-white">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-cyan mx-auto mb-4"></div>
					<p className="text-white/60">Checking governance token balance...</p>
				</div>
			</div>
		)
	}

	if (!address) {
		return (
			<div className="min-h-screen flex items-center justify-center text-white">
				<div className="text-center">
					<h1 className="text-4xl font-black mb-4">Connect Your Wallet</h1>
					<p className="text-white/60 mb-8">You need to connect your wallet to create a proposal</p>
				</div>
			</div>
		)
	}

	if (!hasMinimumBalance) {
		return (
			<div className="min-h-screen flex items-center justify-center text-white">
				<div className="glass-card p-12 rounded-[3rem] border border-white/5 text-center max-w-md">
					<h1 className="text-4xl font-black mb-4">Insufficient Governance Tokens</h1>
					<p className="text-white/60 mb-6">
						You need at least {minimumTokens} governance tokens to create a proposal.
					</p>
					<div className="text-brand-cyan text-2xl font-bold mb-8">
						Current Balance: {governanceTokenBalance} tokens
					</div>
					<button className="iridescent-border px-8 py-3 rounded-xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
						Get Governance Tokens
					</button>
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
						Submit a governance proposal for community review and voting.
					</p>
				</header>

				<form onSubmit={handleSubmit} className="space-y-8">
					{/* Basic Fields */}
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
											placeholder="Enter detailed proposal description using Markdown formatting"
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

					{/* Type-specific Fields */}
					<div className="glass-card p-8 rounded-[2.5rem] border border-white/5">
						<h2 className="text-2xl font-black mb-6 tracking-tight">
							{formData.type === "scholarship" && "Scholarship Details"}
							{formData.type === "parameter_change" && "Parameter Change Details"}
							{formData.type === "new_course" && "Course Details"}
						</h2>
						{renderTypeSpecificFields()}
					</div>

					{/* Submit Section */}
					<div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
						<div className="text-sm text-white/40">
							Your governance token balance: <span className="text-brand-cyan font-bold">{governanceTokenBalance} tokens</span>
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
								disabled={isSubmitting || !formData.title || !formData.description || !hasMinimumBalance}
								className="px-8 py-3 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan font-black uppercase tracking-widest rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all"
							>
								{isSubmitting ? "Submitting..." : "Submit Proposal"}
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	)
}

export default DaoPropose
