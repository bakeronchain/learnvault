import { Card } from "@stellar/design-system"
import { type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useWallet } from "../hooks/useWallet"
import ConnectAccount from "./ConnectAccount"

type ConnectWalletGuardProps = {
	children: ReactNode
}

// If no wallet is connected, show a prompt instead of the page content.
export default function ConnectWalletGuard({ children }: ConnectWalletGuardProps) {
	const { address } = useWallet()
	const { t } = useTranslation()

	if (!address) {
		return (
			<div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
				<h2 className="text-2xl font-semibold text-white">
					{t("connect.connectToContinue")}
				</h2>
				<p className="mt-3 text-sm text-white/70">
					{t("connect.connectDesc")}
				</p>
				<div className="mt-6 flex justify-center">
					<ConnectAccount />
				</div>
			</div>
		)
	}

	return <>{children}</>
}