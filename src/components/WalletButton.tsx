import { Button, Icon, Text, Modal, Profile } from "@stellar/design-system"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import ConfirmDialog from "./ConfirmDialog"
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

			<Profile
				publicAddress={address}
				size="md"
				isShort
				onClick={() => setShowDisconnectModal(true)}
			/>
		</div>
	)
}
