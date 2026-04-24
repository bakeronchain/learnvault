import { Button, Icon } from "@stellar/design-system"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useWallet } from "../hooks/useWallet"
import { WalletInfoModal } from "./WalletInfoModal"
import { motion } from "framer-motion"

/**
 * Wallet control button for the navigation bar.
 * In disconnected state: triggers wallet connection.
 * In connected state: shows compact identity and triggers info modal.
 */
export const WalletButton = () => {
	const [showModal, setShowModal] = useState(false)
	const { address, isPending, isReconnecting, balances } = useWallet()
	const { t } = useTranslation()
	
	const buttonLabel =
		isPending || isReconnecting ? t("wallet.loading") : t("wallet.connect")

	const handleConnect = async () => {
		// Dynamic import to keep main bundle size small
		const { connectWallet } = await import("../util/wallet")
		await connectWallet()
	}

	const handleDisconnect = async () => {
		const { disconnectWallet } = await import("../util/wallet")
		await disconnectWallet()
		setShowModal(false)
	}

	if (!address) {
		return (
			<Button
				variant="secondary"
				size="md"
				onClick={() => void handleConnect()}
				disabled={isReconnecting}
				id="nav-connect-wallet"
			>
				<Icon.Wallet02 />
				{buttonLabel}
			</Button>
		)
	}

	return (
		<>
			{/* Compact trigger with premium glassmorphic style */}
			<motion.button
				whileHover={{ scale: 1.02, y: -2 }}
				whileTap={{ scale: 0.98 }}
				onClick={() => setShowModal(true)}
				className="glass flex items-center gap-4 px-4 py-2 rounded-2xl border border-white/10 hover:border-brand-cyan/30 transition-all bg-white/5 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.3)] group relative overflow-hidden"
				aria-label={t("wallet.view_details", "View wallet details")}
				id="nav-wallet-trigger"
			>
				{/* Inner glow effect on hover */}
				<div className="absolute inset-0 bg-linear-to-r from-brand-cyan/0 via-brand-cyan/5 to-brand-cyan/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />

				<div className="flex flex-col items-end hidden sm:flex pointer-events-none">
					<span className="text-[9px] font-black uppercase tracking-widest text-white/40 group-hover:text-brand-cyan transition-colors">
						Wallet
					</span>
					<span className="text-[13px] font-black text-white/90 tracking-tight">
						{balances?.lrn?.balance ?? "0"} LRN
					</span>
				</div>
				
				<div className="w-9 h-9 rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-slate-800 relative z-10">
					<img 
						src={`https://id.lobstr.co/${address}.png`} 
						alt="Wallet Avatar" 
						className="w-full h-full object-cover"
					/>
				</div>
			</motion.button>

			<WalletInfoModal 
				isOpen={showModal} 
				onClose={() => setShowModal(false)} 
				onDisconnect={() => void handleDisconnect()} 
			/>
		</>
	)
}
