import { AnimatePresence, motion } from "framer-motion"
import {
	ArrowRight,
	Cpu,
	HelpCircle,
	Lock,
	Search,
	Sparkles,
	ThumbsDown,
	ThumbsUp,
	Wallet,
	X,
} from "lucide-react"
import React, { useMemo, useState } from "react"

interface FAQItem {
	id: string
	question: string
	answer: string
	category: "Soroban" | "Web3 Wallets" | "File Encryption"
	tags: string[]
}

const FAQ_ITEMS: FAQItem[] = [
	{
		id: "soroban-1",
		category: "Soroban",
		question: "What is Soroban and how does it integrate with LearnVault?",
		answer: "Soroban is Stellar's native, high-performance smart contract platform built with Rust. It provides predictable fees, state archiving, and full WASM execution. LearnVault leverages Soroban smart contracts to automate reputation tracking (our LRN token) and manage decentralized treasury distributions (e.g. scholarship disbursements) directly on-chain when learning milestones are successfully verified.",
		tags: ["stellar", "soroban", "rust", "wasm", "smart contracts"],
	},
	{
		id: "soroban-2",
		category: "Soroban",
		question: "What are the gas/network fees for executing transactions on Soroban?",
		answer: "Stellar and Soroban are designed to be extremely low-cost and efficient. While traditional networks suffer from unpredictable, high gas surges, a typical Soroban contract invocation costs a small fraction of a cent (paid in XLM). LearnVault also implements gas optimization patterns in our contracts so that scholars and contributors face minimal friction during active learning sprint interactions.",
		tags: ["fees", "gas", "xlm", "transactions", "costs"],
	},
	{
		id: "soroban-3",
		category: "Soroban",
		question: "How do I deploy or test Soroban contracts locally?",
		answer: "To test Soroban contracts locally, you can use the `stellar-cli` tool. First, ensure you have Rust and Cargo installed, then run `cargo install --locked stellar-cli`. You can start a local node with `stellar network start container` or spin up a local development network. The contracts are located inside the `/contracts` directory of our repository, where you can execute `cargo test` to run native unit tests.",
		tags: ["deploy", "cli", "testing", "rust", "local dev"],
	},
	{
		id: "wallet-1",
		category: "Web3 Wallets",
		question: "Which Web3 wallets are supported on LearnVault?",
		answer: "LearnVault integrates with `@creit.tech/stellar-wallets-kit`, enabling unified support for all major Stellar web3 wallets. This includes Freighter (the standard browser extension), Albedo, Rovo, Hana Wallet, and Lobstr. You can easily select your preferred wallet by clicking the 'Connect Wallet' button in the navigation bar.",
		tags: ["wallet", "freighter", "albedo", "rovo", "connect"],
	},
	{
		id: "wallet-2",
		category: "Web3 Wallets",
		question: "Why does the wallet ask me to sign a transaction, and is it safe?",
		answer: "In Web3, signing a transaction or message is how you cryptographically prove ownership of your stellar address without sharing your private key. When you enroll in a course, submit a milestone, or vote in the DAO, LearnVault submits a transaction payload to your wallet extension. Your extension prompts you to sign it securely. LearnVault never has access to your private key or seed phrase.",
		tags: ["signing", "security", "private key", "transactions", "safety"],
	},
	{
		id: "wallet-3",
		category: "Web3 Wallets",
		question: "What is a Trustline and why is it required for LRN and USDC tokens?",
		answer: "The Stellar network utilizes 'trustlines' to prevent spam assets from being deposited into accounts. A trustline is an explicit opt-in that tells the Stellar ledger your account is willing to hold a specific asset issued by a specific account. To receive LearnVault's native LRN reputation tokens or USDC milestone payouts, you must execute a quick 'Establish Trustline' transaction via your connected wallet.",
		tags: ["trustline", "lrn", "usdc", "stellar asset", "spam"],
	},
	{
		id: "encrypt-1",
		category: "File Encryption",
		question: "How does LearnVault securely encrypt my milestone submissions?",
		answer: "Your privacy is a core pillar of LearnVault. When you submit project files, code screenshots, or milestone answers, they are encrypted client-side in your browser using strong AES-GCM-256 symmetric encryption. The encrypted ciphertext is then uploaded to IPFS (InterPlanetary File System). The corresponding decryption key is never shared on public networks or stored on centralized databases.",
		tags: ["aes", "ipfs", "encryption", "milestone", "security"],
	},
	{
		id: "encrypt-2",
		category: "File Encryption",
		question: "Who has the authority to decrypt and review my submitted coursework?",
		answer: "Only the designated DAO sponsors or authorized peer reviewers who are cryptographically assigned to your scholarship milestone have the access rights to request decryption. When a reviewer opens your submission, their wallet validates their status using our Soroban governance contract, derives the secure key exchange payload, and decrypts the homework files dynamically in their secure browser sandbox.",
		tags: ["reviewers", "decryption", "permissions", "dao", "cryptography"],
	},
	{
		id: "encrypt-3",
		category: "File Encryption",
		question: "What happens if I lose my Web3 wallet or private keys?",
		answer: "Because LearnVault is a fully decentralized, non-custodial protocol, we do not store, manage, or have recovery options for your wallet credentials. Your private key and secret seed phrase are the sole access points to your on-chain reputation, LRN tokens, and encrypted files. We highly recommend using hardware wallets or secure, offline paper backups for your seed phrase.",
		tags: ["recovery", "non-custodial", "private key", "loss", "seed phrase"],
	},
]

const escapeRegExp = (string: string) => {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function FAQSection() {
	const [searchQuery, setSearchQuery] = useState("")
	const [activeCategory, setActiveCategory] = useState<string>("All")
	const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})
	const [helpfulFeedback, setHelpfulFeedback] = useState<Record<string, "yes" | "no">>({})
	const [feedbackAnimation, setFeedbackAnimation] = useState<string | null>(null)

	const categories = ["All", "Soroban", "Web3 Wallets", "File Encryption"]

	const filteredFAQ = useMemo(() => {
		return FAQ_ITEMS.filter((item) => {
			const matchesCategory =
				activeCategory === "All" || item.category === activeCategory

			const cleanQuery = searchQuery.trim().toLowerCase()
			if (!cleanQuery) return matchesCategory

			const matchesSearch =
				item.question.toLowerCase().includes(cleanQuery) ||
				item.answer.toLowerCase().includes(cleanQuery) ||
				item.tags.some((tag) => tag.toLowerCase().includes(cleanQuery))

			return matchesCategory && matchesSearch
		})
	}, [activeCategory, searchQuery])

	const toggleItem = (id: string) => {
		setExpandedItems((prev) => ({
			...prev,
			[id]: !prev[id],
		}))
	}

	const handleHelpful = (id: string, type: "yes" | "no") => {
		if (helpfulFeedback[id] === type) return // already selected

		setHelpfulFeedback((prev) => ({
			...prev,
			[id]: type,
		}))

		setFeedbackAnimation(id)
		setTimeout(() => setFeedbackAnimation(null), 1000)
	}

	const getCategoryIcon = (category: string) => {
		switch (category) {
			case "Soroban":
				return <Cpu className="w-4 h-4 text-brand-cyan" />
			case "Web3 Wallets":
				return <Wallet className="w-4 h-4 text-brand-blue" />
			case "File Encryption":
				return <Lock className="w-4 h-4 text-brand-purple" />
			default:
				return <HelpCircle className="w-4 h-4 text-brand-emerald" />
		}
	}

	const highlightText = (text: string, search: string) => {
		if (!search.trim()) return text
		const regex = new RegExp(`(${escapeRegExp(search)})`, "gi")
		const parts = text.split(regex)
		return parts.map((part, index) =>
			regex.test(part) ? (
				<mark
					key={index}
					className="bg-brand-cyan/20 text-brand-cyan rounded-[4px] px-1 font-semibold border-b border-brand-cyan/30"
				>
					{part}
				</mark>
			) : (
				part
			),
		)
	}

	return (
		<div className="w-full max-w-4xl mx-auto px-4 py-8">
			{/* Header */}
			<div className="text-center mb-12 flex flex-col items-center">
				<div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-white/5 mb-4 animate-in fade-in slide-in-from-top-4 duration-500">
					<Sparkles className="w-4 h-4 text-brand-cyan animate-pulse" />
					<span className="text-xs font-black uppercase tracking-widest text-white/70">
						Help Center
					</span>
				</div>
				<h2 className="text-4xl sm:text-5xl font-black mb-4 tracking-tight leading-tight">
					Got questions? We've got <span className="text-gradient">answers</span>.
				</h2>
				<p className="text-white/50 text-base sm:text-lg max-w-xl leading-relaxed">
					Find quick answers about Soroban contracts, Web3 credentials, and
					highly secure client-side file encryption.
				</p>
			</div>

			{/* Search and Filter Section */}
			<div className="glass-card p-6 rounded-3xl border border-white/8 mb-8 shadow-2xl relative overflow-hidden group hover:border-white/12 transition-all duration-300">
				{/* Background ambient glow */}
				<div className="absolute top-0 right-0 w-32 h-32 bg-brand-cyan/5 blur-2xl rounded-full pointer-events-none group-hover:bg-brand-cyan/8 transition-colors" />
				<div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-purple/5 blur-2xl rounded-full pointer-events-none group-hover:bg-brand-purple/8 transition-colors" />

				<div className="flex flex-col gap-6 relative z-10">
					{/* Search input */}
					<div className="relative flex items-center">
						<Search className="absolute left-4 w-5 h-5 text-white/30 group-focus-within:text-brand-cyan transition-colors" />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search by keywords, tags (e.g. freighter, aes, rust)..."
							className="w-full pl-12 pr-10 py-3.5 bg-white/5 border border-white/8 rounded-2xl text-white placeholder-white/30 focus:outline-hidden focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/30 focus:bg-white/8 transition-all"
						/>
						{searchQuery && (
							<button
								type="button"
								onClick={() => setSearchQuery("")}
								className="absolute right-4 p-1 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"
								aria-label="Clear search query"
							>
								<X className="w-4 h-4" />
							</button>
						)}
					</div>

					{/* Category filter tabs */}
					<div className="flex flex-wrap gap-2 pt-1 border-t border-white/5">
						{categories.map((category) => {
							const isActive = activeCategory === category
							return (
								<button
									key={category}
									onClick={() => setActiveCategory(category)}
									className={`relative px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${
										isActive
											? "text-brand-cyan bg-brand-cyan/10 border border-brand-cyan/20 shadow-glow-cyan"
											: "text-white/60 hover:text-white bg-white/0 border border-transparent hover:bg-white/5"
									}`}
								>
									{category !== "All" && getCategoryIcon(category)}
									{category}
								</button>
							)
						})}
					</div>
				</div>
			</div>

			{/* FAQ Accordion List */}
			<div className="flex flex-col gap-4">
				<AnimatePresence mode="popLayout">
					{filteredFAQ.length > 0 ? (
						filteredFAQ.map((item, index) => {
							const isOpen = !!expandedItems[item.id]
							const hasFeedback = helpfulFeedback[item.id]
							const isAnimating = feedbackAnimation === item.id

							return (
								<motion.div
									layout
									key={item.id}
									initial={{ opacity: 0, y: 15 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, scale: 0.98 }}
									transition={{ duration: 0.35, ease: "easeOut" }}
									className={`glass-card rounded-[1.75rem] border transition-all duration-300 overflow-hidden ${
										isOpen
											? "border-brand-cyan/20 bg-brand-cyan/[0.02]"
											: "border-white/5 hover:border-white/10 hover:bg-white/[0.01]"
									}`}
								>
									{/* Accordion Header */}
									<button
										type="button"
										id={`faq-header-${item.id}`}
										aria-expanded={isOpen}
										aria-controls={`faq-content-${item.id}`}
										onClick={() => toggleItem(item.id)}
										className="w-full text-left px-6 py-5 sm:px-8 flex items-start justify-between gap-4 focus:outline-hidden group"
									>
										<div className="flex flex-col gap-2">
											<span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/30 group-hover:text-white/40 transition-colors">
												{getCategoryIcon(item.category)}
												{item.category}
											</span>
											<h3 className="font-bold text-base sm:text-lg text-white/90 group-hover:text-white transition-colors leading-snug">
												{highlightText(item.question, searchQuery)}
											</h3>
										</div>

										<div className="shrink-0 mt-6">
											<motion.div
												animate={{ rotate: isOpen ? 180 : 0 }}
												transition={{ duration: 0.3, ease: "easeInOut" }}
												className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-colors ${
													isOpen
														? "border-brand-cyan/30 text-brand-cyan bg-brand-cyan/10"
														: "border-white/8 text-white/40 group-hover:text-white/80 group-hover:border-white/15"
												}`}
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="2.5"
													strokeLinecap="round"
													strokeLinejoin="round"
													className="w-4 h-4"
												>
													<polyline points="6 9 12 15 18 9" />
												</svg>
											</motion.div>
										</div>
									</button>

									{/* Accordion Content */}
									<AnimatePresence initial={false}>
										{isOpen && (
											<motion.div
												id={`faq-content-${item.id}`}
												role="region"
												aria-labelledby={`faq-header-${item.id}`}
												initial={{ height: 0, opacity: 0 }}
												animate={{
													height: "auto",
													opacity: 1,
													transition: {
														height: { duration: 0.25, ease: "easeOut" },
														opacity: { duration: 0.2 },
													},
												}}
												exit={{
													height: 0,
													opacity: 0,
													transition: {
														height: { duration: 0.2, ease: "easeIn" },
														opacity: { duration: 0.15 },
													},
												}}
											>
												<div className="px-6 pb-6 sm:px-8 sm:pb-8 pt-1 border-t border-white/5 bg-black/10">
													<p className="text-white/60 text-sm sm:text-base leading-relaxed mb-5 font-normal">
														{highlightText(item.answer, searchQuery)}
													</p>

													{/* Tags */}
													<div className="flex flex-wrap gap-1.5 mb-6">
														{item.tags.map((tag) => (
															<span
																key={tag}
																className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/5 border border-white/5 text-white/40"
															>
																#{tag}
															</span>
														))}
													</div>

													{/* Helpfulness feedback rating */}
													<div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/5 text-xs text-white/30">
														<span>Was this answer helpful?</span>
														<div className="flex items-center gap-2">
															<button
																type="button"
																onClick={() => handleHelpful(item.id, "yes")}
																disabled={!!hasFeedback}
																className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
																	hasFeedback === "yes"
																		? "border-brand-emerald/30 text-brand-emerald bg-brand-emerald/10 font-bold"
																		: "border-white/5 text-white/40 hover:text-white hover:border-white/10 hover:bg-white/5"
																}`}
															>
																<ThumbsUp className="w-3.5 h-3.5" />
																Yes
															</button>
															<button
																type="button"
																onClick={() => handleHelpful(item.id, "no")}
																disabled={!!hasFeedback}
																className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
																	hasFeedback === "no"
																		? "border-brand-purple/30 text-brand-purple bg-brand-purple/10 font-bold"
																		: "border-white/5 text-white/40 hover:text-white hover:border-white/10 hover:bg-white/5"
																}`}
															>
																<ThumbsDown className="w-3.5 h-3.5" />
																No
															</button>

															{isAnimating && (
																<motion.span
																	initial={{ opacity: 0, scale: 0.8 }}
																	animate={{ opacity: 1, scale: 1 }}
																	exit={{ opacity: 0 }}
																	className="text-brand-cyan font-bold tracking-widest uppercase text-[10px] ml-2 animate-bounce"
																>
																	Thank you!
																</motion.span>
															)}
														</div>
													</div>
												</div>
											</motion.div>
										)}
									</AnimatePresence>
								</motion.div>
							)
						})
					) : (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className="glass-card text-center p-12 rounded-[1.75rem] border border-white/5 flex flex-col items-center gap-4"
						>
							<div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center text-white/30">
								<Search className="w-6 h-6" />
							</div>
							<div>
								<h4 className="font-bold text-lg text-white mb-1">
									No matches found
								</h4>
								<p className="text-white/40 text-sm max-w-xs mx-auto leading-relaxed">
									We couldn't find any FAQs matching "{searchQuery}". Try using
									different keywords or clearing filters.
								</p>
							</div>
							<button
								type="button"
								onClick={() => {
									setSearchQuery("")
									setActiveCategory("All")
								}}
								className="mt-2 px-6 py-2.5 glass border border-white/10 text-brand-cyan hover:text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white/5 transition-all"
							>
								Reset Filters
							</button>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			{/* Contact Support Footer Card */}
			<div className="glass-card mt-12 p-8 rounded-3xl border border-brand-cyan/15 relative overflow-hidden group shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
				{/* Soft mesh background */}
				<div className="absolute inset-0 bg-linear-to-br from-brand-cyan/5 via-brand-purple/5 to-transparent pointer-events-none" />

				<div className="flex flex-col gap-2 relative z-10 text-center sm:text-left">
					<h3 className="text-xl font-black text-white flex items-center justify-center sm:justify-start gap-2">
						Still have questions?
					</h3>
					<p className="text-white/40 text-sm max-w-md leading-relaxed font-normal">
						Our community of developers and instructors is active 24/7. Join the
						LearnVault Discord server to get help with Stellar, Soroban, and homework encryption.
					</p>
				</div>

				<a
					href="https://discord.gg/stellar"
					target="_blank"
					rel="noopener noreferrer"
					className="iridescent-border px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-transform shrink-0 flex items-center gap-2 shadow-xl shadow-brand-cyan/10 relative z-10"
				>
					Join Discord <ArrowRight className="w-4 h-4" />
				</a>
			</div>
		</div>
	)
}
