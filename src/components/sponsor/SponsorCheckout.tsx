import { AnimatePresence, motion } from "framer-motion"
import {
	CheckCircle2,
	ChevronRight,
	Coins,
	FileDown,
	FileSpreadsheet,
	HelpCircle,
	Info,
	Trash2,
	Upload,
	Users,
	AlertCircle,
	Copy,
	Check,
} from "lucide-react"
import React, { useMemo, useRef, useState } from "react"

interface ParsedAddress {
	address: string
	isValid: boolean
	error?: string
}

export function SponsorCheckout() {
	const [rawInput, setRawInput] = useState("")
	const [fileError, setFileError] = useState<string | null>(null)
	const [isProcessing, setIsProcessing] = useState(false)
	const [checkoutStep, setCheckoutStep] = useState<"setup" | "receipt">("setup")
	const [txHash] = useState("0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""))
	const [copiedId, setCopiedId] = useState<string | null>(null)

	const fileInputRef = useRef<HTMLInputElement>(null)

	const LICENSE_PRICE_USDC = 25
	const XLM_GAS_PER_STUDENT = 0.05
	const XLM_TO_USDC_RATE = 0.35 // 1 XLM = 0.35 USDC equivalent

	// Stellar Address validation regex
	const isValidStellarAddress = (addr: string): { isValid: boolean; error?: string } => {
		const clean = addr.trim()
		if (!clean) return { isValid: false, error: "Address is empty" }
		if (!clean.startsWith("G")) {
			return { isValid: false, error: "Must start with capital 'G'" }
		}
		if (clean.length !== 56) {
			return { isValid: false, error: `Invalid length (${clean.length}/56 characters)` }
		}
		if (!/^[A-Z2-7]+$/.test(clean)) {
			return { isValid: false, error: "Contains invalid base32 characters" }
		}
		return { isValid: true }
	}

	// Parse addresses dynamically from input
	const parsedAddresses = useMemo<ParsedAddress[]>(() => {
		if (!rawInput.trim()) return []
		// Split by comma, semi-colon, whitespace, or newlines
		const lines = rawInput.split(/[\s,;]+/)
		const uniqueLines = Array.from(new Set(lines.map((l) => l.trim()))).filter(Boolean)

		return uniqueLines.map((addr) => {
			const validation = isValidStellarAddress(addr)
			return {
				address: addr,
				isValid: validation.isValid,
				error: validation.error,
			}
		})
	}, [rawInput])

	const counts = useMemo(() => {
		const valid = parsedAddresses.filter((a) => a.isValid).length
		const invalid = parsedAddresses.filter((a) => !a.isValid).length
		return {
			total: parsedAddresses.length,
			valid,
			invalid,
		}
	}, [parsedAddresses])

	// Cost Calculations
	const estimates = useMemo(() => {
		const validCount = counts.valid
		const subtotalLicenses = validCount * LICENSE_PRICE_USDC
		const totalGasXLM = validCount * XLM_GAS_PER_STUDENT
		const totalGasUSD = totalGasXLM * XLM_TO_USDC_RATE
		const grandTotal = subtotalLicenses + totalGasUSD

		return {
			subtotalLicenses,
			totalGasXLM,
			totalGasUSD,
			grandTotal,
		}
	}, [counts.valid])

	// Handle text file / CSV parsing
	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		setFileError(null)
		const file = e.target.files?.[0]
		if (!file) return

		if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
			setFileError("Only CSV or TXT files are supported")
			return
		}

		const reader = new FileReader()
		reader.onload = (event) => {
			const text = event.target?.result as string
			if (!text) return

			// Extract all potential Stellar addresses (56-char strings starting with G)
			// matching basic stellar address formats
			const regex = /\b(G[A-D2-7][A-Z2-7]{54})\b/g
			const matches = text.match(regex)

			if (matches && matches.length > 0) {
				const uniqueMatches = Array.from(new Set(matches))
				// Append to current raw input
				setRawInput((prev) => {
					const existing = prev.trim()
					return existing 
						? `${existing}\n${uniqueMatches.join("\n")}`
						: uniqueMatches.join("\n")
				})
			} else {
				setFileError("No valid Stellar public keys found in file")
			}
		}
		reader.readAsText(file)
	}

	const triggerFileSelect = () => {
		fileInputRef.current?.click()
	}

	const handleCheckout = () => {
		if (counts.valid === 0) return
		setIsProcessing(true)
		// Simulate blockchain validation and minting
		setTimeout(() => {
			setIsProcessing(false)
			setCheckoutStep("receipt")
		}, 2000)
	}

	const handleReset = () => {
		setRawInput("")
		setCheckoutStep("setup")
	}

	const handleCopy = (id: string, text: string) => {
		void navigator.clipboard.writeText(text)
		setCopiedId(id)
		setTimeout(() => setCopiedId(null), 1500)
	}

	return (
		<div className="w-full max-w-4xl mx-auto px-4 py-8">
			{/* Steps switching */}
			<AnimatePresence mode="wait">
				{checkoutStep === "setup" ? (
					<motion.div
						key="setup"
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -15 }}
						transition={{ duration: 0.35 }}
						className="space-y-8"
					>
						{/* Header */}
						<div className="text-center mb-8">
							<div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-white/5 mb-4">
								<Users className="w-4 h-4 text-brand-cyan" />
								<span className="text-xs font-black uppercase tracking-widest text-white/70">
									Sponsorship Gateway
								</span>
							</div>
							<h1 className="text-4xl sm:text-5xl font-black mb-4 tracking-tight leading-tight">
								Sponsor <span className="text-gradient">Student Licenses</span>
							</h1>
							<p className="text-white/50 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
								Purchase LearnVault education access licenses in bulk. Provide a list of Stellar
								wallet addresses below to allocate access rights and automatically seed Soroban gas limits.
							</p>
						</div>

						{/* Layout Grid: Inputs vs Estimations */}
						<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
							{/* Inputs side (2/3 width) */}
							<div className="lg:col-span-2 space-y-6">
								{/* Text & CSV Uploader */}
								<div className="glass-card p-6 rounded-3xl border border-white/8 relative">
									<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
										<h3 className="font-bold text-white/90 text-lg">
											1. Add Student Addresses
										</h3>

										{/* CSV File Trigger */}
										<div>
											<input
												type="file"
												ref={fileInputRef}
												onChange={handleFileUpload}
												accept=".csv,.txt"
												className="hidden"
											/>
											<button
												type="button"
												onClick={triggerFileSelect}
												className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/8 border border-white/5 hover:border-white/10 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
											>
												<FileSpreadsheet className="w-3.5 h-3.5 text-brand-emerald" />
												Upload CSV / TXT
											</button>
										</div>
									</div>

									{fileError && (
										<div className="mb-4 p-3.5 bg-brand-purple/10 border border-brand-purple/20 rounded-xl flex items-center gap-2 text-xs text-brand-purple">
											<AlertCircle className="w-4 h-4 shrink-0" />
											<span>{fileError}</span>
										</div>
									)}

									{/* Multi address list textarea */}
									<div className="relative">
										<textarea
											value={rawInput}
											onChange={(e) => setRawInput(e.target.value)}
											placeholder="Paste student addresses here (separated by spaces, commas, or newlines)&#10;Example:&#10;GDCB7T...&#10;GBR75X..."
											rows={7}
											className="w-full p-5 bg-white/5 border border-white/8 rounded-2xl text-white placeholder-white/20 font-mono text-xs focus:outline-hidden focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/30 focus:bg-white/8 transition-all resize-y"
										/>
										{rawInput && (
											<button
												type="button"
												onClick={() => setRawInput("")}
												className="absolute right-4 bottom-4 p-2 bg-black/40 hover:bg-black/75 rounded-xl transition-colors text-white/50 hover:text-white"
												title="Clear all inputs"
											>
												<Trash2 className="w-4 h-4" />
											</button>
										)}
									</div>
								</div>

								{/* Address validation lists */}
								{parsedAddresses.length > 0 && (
									<div className="glass-card p-6 rounded-3xl border border-white/8 space-y-4">
										<div className="flex justify-between items-center border-b border-white/5 pb-3">
											<h3 className="font-bold text-white/90 text-sm flex items-center gap-2">
												Validation Status
												<span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/5 font-mono">
													{counts.total} items
												</span>
											</h3>

											<div className="flex items-center gap-3 text-xs">
												<span className="text-brand-emerald flex items-center gap-1">
													<span className="w-1.5 h-1.5 rounded-full bg-brand-emerald" />
													{counts.valid} Valid
												</span>
												<span className="text-brand-purple flex items-center gap-1">
													<span className="w-1.5 h-1.5 rounded-full bg-brand-purple" />
													{counts.invalid} Invalid
												</span>
											</div>
										</div>

										<div className="max-h-[220px] overflow-y-auto pr-1 space-y-2">
											{parsedAddresses.map((item, idx) => (
												<div
													key={`${item.address}-${idx}`}
													className={`p-3 rounded-xl border flex items-center justify-between gap-4 text-xs ${
														item.isValid
															? "border-brand-emerald/10 bg-brand-emerald/[0.01]"
															: "border-brand-purple/10 bg-brand-purple/[0.01]"
													}`}
												>
													<span className="font-mono text-white/70 overflow-hidden text-ellipsis whitespace-nowrap">
														{item.address}
													</span>

													<div className="shrink-0 flex items-center gap-2">
														{item.isValid ? (
															<span className="px-2 py-0.5 rounded-full bg-brand-emerald/10 text-brand-emerald text-[9px] font-black uppercase tracking-wider border border-brand-emerald/10">
																Passed
															</span>
														) : (
															<span
																className="px-2 py-0.5 rounded-full bg-brand-purple/10 text-brand-purple text-[9px] font-black uppercase tracking-wider border border-brand-purple/10 flex items-center gap-1"
																title={item.error}
															>
																Failed: {item.error}
															</span>
														)}
													</div>
												</div>
											))}
										</div>
									</div>
								)}
							</div>

							{/* Cost calculations panel (1/3 width) */}
							<div className="space-y-6">
								<div className="glass-card p-6 rounded-3xl border border-white/8 relative overflow-hidden group shadow-2xl flex flex-col justify-between min-h-[380px]">
									{/* Top ambient glow */}
									<div className="absolute top-0 right-0 w-32 h-32 bg-brand-cyan/5 blur-2xl rounded-full pointer-events-none" />

									<div className="space-y-6 relative z-10">
										<h3 className="font-bold text-white/95 text-lg border-b border-white/5 pb-3">
											2. Checkout Summary
										</h3>

										{/* Key Figures */}
										<div className="space-y-4 text-sm font-normal">
											<div className="flex justify-between items-center text-white/40">
												<span>Sponsored Students</span>
												<span className="font-bold text-white font-mono">
													{counts.valid}
												</span>
											</div>

											<div className="flex justify-between items-center text-white/40">
												<span>License (per student)</span>
												<span className="font-bold text-white font-mono">
													{LICENSE_PRICE_USDC} USDC
												</span>
											</div>

											<div className="flex justify-between items-center text-white/40">
												<span>Gas Buffer (per student)</span>
												<span className="font-bold text-white font-mono flex items-center gap-1">
													{XLM_GAS_PER_STUDENT} XLM
													<HelpCircle
														className="w-3.5 h-3.5 text-white/20 cursor-help"
														title={`Stellar operations require gas seed base fees. We allocate XLM buffer converted to USDC.`}
													/>
												</span>
											</div>
										</div>

										<div className="h-px bg-white/5" />

										{/* Real-time costs calculations breakdown */}
										<div className="space-y-3.5 text-xs font-normal">
											<div className="flex justify-between items-center">
												<span className="text-white/40">Access Licenses Total</span>
												<span className="font-bold font-mono text-white">
													{estimates.subtotalLicenses} USDC
												</span>
											</div>

											<div className="flex justify-between items-center">
												<span className="text-white/40">Stellar Execution Gas</span>
												<span className="font-bold font-mono text-white">
													{estimates.totalGasXLM.toFixed(2)} XLM
												</span>
											</div>

											<div className="flex justify-between items-center">
												<span className="text-white/40">Gas Cost (USDC Equiv.)</span>
												<span className="font-bold font-mono text-white/50">
													${estimates.totalGasUSD.toFixed(2)} USDC
												</span>
											</div>
										</div>
									</div>

									{/* Total & Button */}
									<div className="space-y-6 pt-6 border-t border-white/5 relative z-10">
										<div className="flex justify-between items-baseline">
											<span className="text-xs font-black uppercase tracking-wider text-brand-cyan">
												Total Cost
											</span>
											<span className="text-2xl sm:text-3xl font-black font-mono text-white">
												{estimates.grandTotal.toFixed(2)}{" "}
												<span className="text-xs text-white/40 font-bold">USDC</span>
											</span>
										</div>

										<button
											type="button"
											onClick={handleCheckout}
											disabled={counts.valid === 0 || isProcessing}
											className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
												counts.valid === 0
													? "bg-white/5 text-white/20 border border-white/5 cursor-not-allowed"
													: isProcessing
														? "bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/20 cursor-wait"
														: "iridescent-border hover:scale-103 active:scale-97 shadow-xl shadow-brand-cyan/10"
											}`}
										>
											{isProcessing ? (
												<span className="flex items-center justify-center gap-2">
													<svg className="animate-spin h-4 w-4 text-brand-cyan" viewBox="0 0 24 24" fill="none">
														<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
														<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
													</svg>
													Signing Blockchain Payload...
												</span>
											) : (
												<span className="flex items-center justify-center gap-2">
													Authorize & Fund <ChevronRight className="w-4 h-4" />
												</span>
											)}
										</button>
									</div>
								</div>
							</div>
						</div>
					</motion.div>
				) : (
					<motion.div
						key="receipt"
						initial={{ opacity: 0, scale: 0.98 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.98 }}
						transition={{ duration: 0.4 }}
						className="max-w-2xl mx-auto space-y-8"
					>
						{/* Success badge */}
						<div className="flex flex-col items-center text-center space-y-4">
							<div className="w-20 h-20 bg-brand-emerald/10 border border-brand-emerald/20 rounded-3xl flex items-center justify-center shadow-xl shadow-brand-emerald/10 animate-bounce">
								<CheckCircle2 className="w-10 h-10 text-brand-emerald" />
							</div>
							<h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
								Sponsorship Transaction <span className="text-gradient">Completed</span>
							</h2>
							<p className="text-white/40 text-sm max-w-md">
								Soroban smart contracts successfully executed. Access licenses minted and credited to recipient student addresses.
							</p>
						</div>

						{/* Invoice Receipt */}
						<div className="glass-card p-8 rounded-3xl border border-white/8 relative overflow-hidden group shadow-2xl">
							<div className="absolute top-0 right-0 w-32 h-32 bg-brand-emerald/5 blur-2xl rounded-full pointer-events-none" />

							<div className="space-y-6 relative z-10 font-normal">
								{/* Top details */}
								<div className="flex justify-between items-start border-b border-white/5 pb-4">
									<div>
										<p className="text-[10px] font-black text-white/40 uppercase tracking-widest font-mono">
											Invoice Receipt
										</p>
										<p className="text-sm font-bold text-white mt-1">
											LearnVault scholarship fund
										</p>
									</div>
									<div className="text-right">
										<p className="text-[10px] font-black text-white/40 uppercase tracking-widest font-mono">
											Receipt Date
										</p>
										<p className="text-xs text-white/70 mt-1">
											{new Date().toLocaleDateString(undefined, {
												year: "numeric",
												month: "long",
												day: "numeric",
											})}
										</p>
									</div>
								</div>

								{/* Core aggregates */}
								<div className="grid grid-cols-3 gap-6 py-2">
									<div>
										<span className="text-[10px] font-black text-white/40 uppercase tracking-widest block font-mono">
											Students Funded
										</span>
										<span className="text-2xl font-black text-white block mt-1">
											{counts.valid}
										</span>
									</div>
									<div>
										<span className="text-[10px] font-black text-white/40 uppercase tracking-widest block font-mono">
											Licenses Volume
										</span>
										<span className="text-2xl font-black text-brand-cyan block mt-1">
											{estimates.subtotalLicenses} USDC
										</span>
									</div>
									<div>
										<span className="text-[10px] font-black text-white/40 uppercase tracking-widest block font-mono">
											Grand Total
										</span>
										<span className="text-2xl font-black text-brand-emerald block mt-1">
											{estimates.grandTotal.toFixed(2)} USDC
										</span>
									</div>
								</div>

								<div className="h-px bg-white/5" />

								{/* Tx signature hash */}
								<div>
									<span className="text-[10px] font-black text-white/40 uppercase tracking-widest block font-mono mb-2">
										Stellar Transaction Hash
									</span>
									<div className="flex items-center justify-between gap-4 p-3 bg-white/5 border border-white/5 rounded-xl text-xs font-mono">
										<span className="text-white/60 overflow-hidden text-ellipsis whitespace-nowrap">
											{txHash}
										</span>
										<button
											type="button"
											onClick={() => handleCopy("tx", txHash)}
											className="shrink-0 p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
											title="Copy hash"
										>
											{copiedId === "tx" ? (
												<Check className="w-4 h-4 text-brand-emerald" />
											) : (
												<Copy className="w-4 h-4" />
											)}
										</button>
									</div>
								</div>

								<div className="h-px bg-white/5" />

								{/* Sponsored addresses list */}
								<div>
									<span className="text-[10px] font-black text-white/40 uppercase tracking-widest block font-mono mb-3">
										Funded Recipients
									</span>
									<div className="max-h-[140px] overflow-y-auto pr-1 space-y-2">
										{parsedAddresses.filter(a => a.isValid).map((item, idx) => (
											<div
												key={`funded-${item.address}-${idx}`}
												className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between text-xs"
											>
												<span className="font-mono text-white/60 overflow-hidden text-ellipsis whitespace-nowrap">
													{item.address}
												</span>
												<button
													type="button"
													onClick={() => handleCopy(`addr-${idx}`, item.address)}
													className="shrink-0 p-1 hover:bg-white/5 rounded-md text-white/30 hover:text-white transition-colors"
													title="Copy address"
												>
													{copiedId === `addr-${idx}` ? (
														<Check className="w-3.5 h-3.5 text-brand-emerald" />
													) : (
														<Copy className="w-3.5 h-3.5" />
													)}
												</button>
											</div>
										))}
									</div>
								</div>
							</div>
						</div>

						{/* Bottom Receipt options buttons */}
						<div className="flex flex-col sm:flex-row gap-4 justify-center">
							<button
								type="button"
								onClick={handleReset}
								className="px-8 py-3.5 glass border border-white/15 hover:bg-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-103 transition-all"
							>
								Fund More Students
							</button>

							<a
								href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
								target="_blank"
								rel="noopener noreferrer"
								className="iridescent-border px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-103 active:scale-97 transition-all flex items-center justify-center gap-2 shadow-xl shadow-brand-cyan/10"
							>
								View on Explorer ↗
							</a>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}
