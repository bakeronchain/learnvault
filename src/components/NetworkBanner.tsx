import { Icon } from "@stellar/design-system"
import { useTranslation } from "react-i18next"
import { stellarNetwork } from "../contracts/util"

/**
 * NetworkBanner displays a prominent warning banner when the app is running
 * on a non-production network (TESTNET, FUTURENET, or LOCAL).
 *
 * This helps prevent users from accidentally thinking they're on mainnet.
 */
export function NetworkBanner() {
	const { t } = useTranslation()

	// Only show banner on non-production networks
	if (stellarNetwork === "PUBLIC") {
		return null
	}

	const getNetworkConfig = () => {
		switch (stellarNetwork) {
			case "TESTNET":
				return {
					label: "Testnet",
					message: t("network.testnetWarning"),
					bgColor: "bg-yellow-500/10",
					borderColor: "border-yellow-500/30",
					textColor: "text-yellow-200",
					iconColor: "#FCD34D",
				}
			case "FUTURENET":
				return {
					label: "Futurenet",
					message: t("network.futurenetWarning"),
					bgColor: "bg-purple-500/10",
					borderColor: "border-purple-500/30",
					textColor: "text-purple-200",
					iconColor: "#C084FC",
				}
			case "LOCAL":
				return {
					label: "Local",
					message: t("network.localWarning"),
					bgColor: "bg-blue-500/10",
					borderColor: "border-blue-500/30",
					textColor: "text-blue-200",
					iconColor: "#60A5FA",
				}
			default:
				return null
		}
	}

	const config = getNetworkConfig()

	if (!config) {
		return null
	}

	return (
		<div
			className={`w-full ${config.bgColor} border-b ${config.borderColor} py-2 px-4`}
			role="alert"
			aria-live="polite"
		>
			<div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-sm">
				<Icon.AlertTriangle color={config.iconColor} />
				<span className={`font-medium ${config.textColor}`}>
					{config.message}
				</span>
			</div>
		</div>
	)
}
