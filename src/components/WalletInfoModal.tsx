import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useWallet } from "../hooks/useWallet"
import AddressDisplay from "./AddressDisplay"
import { useTranslation } from "react-i18next"

interface WalletInfoModalProps {
	isOpen: boolean
	onClose: () => void
	onDisconnect: () => void
}

/**
 * Enhanced Wallet Information Modal with responsive width and improved readability.
 * Adjusts its footprint based on screen size to avoid looking "thin" on large displays.
 */
export const WalletInfoModal: React.FC<WalletInfoModalProps> = ({
	isOpen,
	onClose,
	onDisconnect,
}) => {
	const { address, balances } = useWallet()
	const { t } = useTranslation()

	if (!address) return null

	return (
		<AnimatePresence>
			{isOpen && (
				<div 
					className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-12"
					aria-modal="true"
					role="dialog"
				>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className="absolute inset-0 bg-black/80 backdrop-blur-2xl"
					/>
					
					{/* Modal Content - Increased width and refined spacing */}
					<motion.div
						initial={{ opacity: 0, scale: 0.9, y: 40 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.9, y: 40 }}
						onClick={(e) => e.stopPropagation()}
						className="relative w-full max-w-2xl glass overflow-hidden rounded-[3rem] border border-white/10 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.8)] bg-slate-900/95 text-white"
					>
						{/* Close button */}
						<button 
							onClick={onClose}
							className="absolute top-8 right-8 p-3 hover:bg-white/10 rounded-full transition-all hover:rotate-90 z-10 bg-white/5 border border-white/10"
							aria-label="Close"
						>
							<svg className="w-6 h-6 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>

						<div className="flex flex-col lg:flex-row h-full">
							{/* Left Column: Identity (Visible as top on mobile) */}
							<div className="lg:w-2/5 p-10 sm:p-12 text-center lg:text-left flex flex-col justify-center bg-linear-to-br from-white/5 to-transparent border-b lg:border-b-0 lg:border-r border-white/10">
								<div className="relative inline-block lg:mx-0 mx-auto mb-10">
									<div className="w-32 h-32 sm:w-40 sm:h-40 rounded-[2.5rem] overflow-hidden border-4 border-brand-cyan/50 shadow-2xl shadow-brand-cyan/30 bg-slate-800 transform hover:scale-105 transition-transform duration-700">
										<img 
											src={`https://id.lobstr.co/${address}.png`} 
											alt="Identicon"
											className="w-full h-full"
										/>
									</div>
									<div className="absolute -bottom-2 -right-2 w-10 h-10 bg-brand-emerald border-4 border-slate-900 rounded-full flex items-center justify-center shadow-lg">
										<div className="w-3 h-3 bg-white rounded-full animate-pulse" />
									</div>
								</div>
								
								<div className="space-y-4">
									<h2 className="text-3xl font-black tracking-tighter text-white leading-tight">
										My Wallet
									</h2>
									<p className="text-xs font-black uppercase tracking-[0.3em] text-brand-cyan/60">
										Trust Verified
									</p>
									<AddressDisplay 
										address={address} 
										fullOnHover={false}
										className="lg:justify-start justify-center"
										addressClassName="text-sm font-mono font-bold tracking-normal text-white/60"
										buttonClassName="bg-white/5 border-white/10"
									/>
								</div>
							</div>

							{/* Right Column: Assets & Actions */}
							<div className="lg:w-3/5 p-10 sm:p-12 flex flex-col justify-between">
								<div className="space-y-12">
									<div className="space-y-6">
										<h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Active Assets</h3>
										
										<div className="space-y-6">
											<div className="group p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-brand-cyan/30 transition-all">
												<div className="flex justify-between items-center mb-2">
													<span className="text-xs font-bold text-white/40 group-hover:text-brand-cyan transition-colors">LearnToken</span>
													<span className="text-[10px] font-black text-brand-cyan/40 bg-brand-cyan/5 px-2 py-0.5 rounded border border-brand-cyan/10">GOVERNANCE</span>
												</div>
												<p className="text-4xl font-black text-white tracking-tighter">
													{balances?.lrn?.balance ?? "0"}
													<span className="text-sm ml-2 font-bold text-white/40">LRN</span>
												</p>
											</div>

											<div className="group p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-white/20 transition-all">
												<div className="flex justify-between items-center mb-2">
													<span className="text-xs font-bold text-white/40">Native Assets</span>
													<span className="text-[10px] font-black text-white/20 bg-white/5 px-2 py-0.5 rounded border border-white/10">GAS</span>
												</div>
												<p className="text-2xl font-black text-white/90 tracking-tighter">
													{balances?.xlm?.balance ?? "0"}
													<span className="text-xs ml-2 font-bold text-white/30">XLM</span>
												</p>
											</div>
										</div>
									</div>
								</div>

								<div className="mt-12 pt-10 border-t border-white/10">
									<div className="flex gap-4">
										<button
											onClick={onDisconnect}
											className="flex-1 py-5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-black uppercase tracking-widest text-xs rounded-2xl border border-red-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
										>
											<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
											</svg>
											Disconnect Wallet
										</button>
									</div>
									<p className="mt-6 text-center text-[10px] text-white/10 uppercase tracking-[0.4em] font-black">
										Stellar Protocol Level Security
									</p>
								</div>
							</div>
						</div>
					</motion.div>
				</div>
			)}
		</AnimatePresence>
	)
}
