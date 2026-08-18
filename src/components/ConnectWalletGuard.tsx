import { Card } from "@stellar/design-system"
import { type ReactNode } from "react"
import { useWallet } from "../hooks/useWallet"
import ConnectAccount from "./ConnectAccount"
import PasskeySignup from "./PasskeySignup"

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
					Get started with LearnVault
				</h2>
				<p className="mt-3 text-sm text-white/70">
					Sign up with Face ID, fingerprint, or your device PIN — no seed
					phrase, no extension. Already have a wallet? Connect it instead.
				</p>
				<div className="mt-6 flex flex-col items-center gap-4">
					<PasskeySignup />
					<div className="flex w-full items-center gap-3 text-xs uppercase tracking-widest text-white/30">
						<span className="h-px flex-1 bg-white/10" />
						or
						<span className="h-px flex-1 bg-white/10" />
					</div>
					<ConnectAccount />
				</div>
			</div>
		)
	}

	return <>{children}</>
}
