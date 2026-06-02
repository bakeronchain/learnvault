import { Icon } from "@stellar/design-system"
import React from "react"
import { useTranslation } from "react-i18next"
import { stellarNetwork } from "../contracts/util"
import { useWallet } from "../hooks/useWallet"

// Format network name with first letter capitalized
const formatNetworkName = (name: string) =>
	name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()

const bgColor = "#F0F2F5"
const textColor = "#4A5362"

const NetworkPill: React.FC = () => {
	const { network, address } = useWallet()
	const { t } = useTranslation()

	const appNetwork = formatNetworkName(stellarNetwork)

	// Check if there's a network mismatch
	const walletNetwork = formatNetworkName(network ?? "")
	const isNetworkMismatch = walletNetwork !== appNetwork

	let title = ""
	let color = "#2ED06E"
	if (!address) {
		title = t("connect.networkConnect")
		color = "#C1C7D0"
	} else if (isNetworkMismatch) {
		title = t("connect.networkMismatch", {
			wallet: walletNetwork,
			app: appNetwork,
		})
		color = "#FF3B30"
	}

	return (
		<div
			style={{
				backgroundColor: bgColor,
				color: textColor,
				padding: "4px 10px",
				borderRadius: "16px",
				fontSize: "12px",
				fontWeight: "bold",
				display: "flex",
				alignItems: "center",
				gap: "4px",
				cursor: isNetworkMismatch ? "help" : "default",
			}}
			title={title}
		>
			<Icon.Circle color={color} />
			{appNetwork}
		</div>
	)
}

export default NetworkPill
