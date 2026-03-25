import { type ReactNode } from "react"
import { useWallet } from "../hooks/useWallet"
import ConnectAccount from "./ConnectAccount"

type ConnectWalletGuardProps = {
	children: ReactNode
}

// If no wallet is connected, show a prompt instead of the page content.
export default function ConnectWalletGuard({
	children,
}: ConnectWalletGuardProps) {
	const { address } = useWallet()

	if (!address) {
		return (
			<div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
				<h2 className="text-2xl font-semibold text-white">
					Connect your wallet to continue
				</h2>
				<p className="mt-3 text-sm text-white/70">
					LearnVault needs a connected Stellar wallet before you can access this
					section.
				</p>
				<div className="mt-6 flex justify-center">
					<ConnectAccount />
				</div>
			</div>
		)
	}

	return <>{children}</>
}
