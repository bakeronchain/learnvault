import { Button, Icon, Modal, Profile, Text } from "@stellar/design-system"

import ConfirmDialog from "./ConfirmDialog"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useWallet } from "../hooks/useWallet"

export const WalletButton = () => {
	const [showDisconnectModal, setShowDisconnectModal] = useState(false)
	const { address, isPending, isReconnecting, balances } = useWallet()
	const { t } = useTranslation()
	const buttonLabel =
		isPending || isReconnecting ? t("wallet.loading") : t("wallet.connect")

	const handleConnect = async () => {
		const { connectWallet } = await import("../util/wallet")
		await connectWallet()
	}

	const handleDisconnect = async () => {
		const { disconnectWallet } = await import("../util/wallet")
		await disconnectWallet()
		setShowDisconnectModal(false)
	}

	if (!address) {
		return (
			<Button
				id="connect-wallet-button"
				variant="secondary"
				size="md"
				onClick={() => void handleConnect()}
				disabled={isReconnecting}
			>
				<Icon.Wallet02 />
				{buttonLabel}
			</Button>
		)
	}

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "row",
				alignItems: "center",
				gap: "5px",
				opacity: isPending || isReconnecting ? 0.6 : 1,
			}}
		>
			<Text as="div" size="sm">
				{t("wallet.balance", { amount: balances?.lrn?.balance ?? "-" })}
			</Text>

			<div id="modalContainer">
				{showDisconnectModal && (
					<ConfirmDialog
						title="Disconnect Wallet"
						description={`You are currently connected as ${address}. Are you sure you want to disconnect? Any unsaved progress may be lost.`}
						confirmLabel={t("wallet.disconnect")}
						cancelLabel={t("wallet.cancel")}
						onConfirm={() => void handleDisconnect()}
						onCancel={() => setShowDisconnectModal(false)}
						isDestructive
					/>
				)}
			</div>
			<motion.button
				onClick={() => setShowDisconnectModal(true)}
				className="flex items-center gap-4 px-4 py-2 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
				whileHover={{ scale: 1.02 }}
				whileTap={{ scale: 0.98 }}
			>
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
		</div>
	)
}
