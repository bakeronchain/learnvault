import { Button, Icon, Text, Modal, Profile } from "@stellar/design-system"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useWallet } from "../hooks/useWallet"
import { connectWallet, disconnectWallet } from "../util/wallet"

export const WalletButton = () => {
	const [showDisconnectModal, setShowDisconnectModal] = useState(false)
	const { address, isPending, isReconnecting, balances } = useWallet()
	const { t } = useTranslation()
	const buttonLabel =
		isPending || isReconnecting ? t("wallet.loading") : t("wallet.connect")

	if (!address) {
		return (
			<Button
				variant="secondary"
				size="md"
				onClick={() => void connectWallet()}
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
				<Modal
					visible={showDisconnectModal}
					onClose={() => setShowDisconnectModal(false)}
					parentId="modalContainer"
				>
					<Modal.Heading>
						{t("wallet.connectedAs")}{" "}
						<code style={{ lineBreak: "anywhere" }}>{address}</code>
						{t("wallet.disconnectPrompt")}
					</Modal.Heading>
					<Modal.Footer itemAlignment="stack">
						<Button
							size="md"
							variant="primary"
							onClick={() => {
								void disconnectWallet().then(() =>
									setShowDisconnectModal(false),
								)
							}}
						>
							{t("wallet.disconnect")}
						</Button>
						<Button
							size="md"
							variant="tertiary"
							onClick={() => {
								setShowDisconnectModal(false)
							}}
						>
							{t("wallet.cancel")}
						</Button>
					</Modal.Footer>
				</Modal>
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
