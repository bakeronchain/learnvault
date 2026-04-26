import { useState } from "react"
import { useNetwork } from "../providers/NetworkProvider"

export function TestnetBanner() {
	const { isTestnet, config, canSwitchNetwork } = useNetwork()
	const [isDismissed, setIsDismissed] = useState(false)

	// Only show for testnet networks
	if (!isTestnet || isDismissed) {
		return null
	}

	return (
		<div className="fixed top-20 left-0 right-0 z-40 px-4 pointer-events-none">
			<div className="max-w-7xl mx-auto">
				<div className="pointer-events-auto bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 backdrop-blur-xl shadow-lg">
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
								<svg
									className="w-5 h-5 text-amber-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
									/>
								</svg>
							</div>
							<div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
								<span className="font-semibold text-amber-200">
									You are on {config.name}
								</span>
								<span className="text-amber-200/70 text-sm hidden sm:inline">
									•
								</span>
								<span className="text-amber-200/70 text-sm">
									Tokens have no real value. Transactions are for testing only.
								</span>
							</div>
						</div>
						<div className="flex items-center gap-2">
							{canSwitchNetwork && (
								<a
									href="/debug"
									className="text-xs font-medium text-amber-300 hover:text-amber-200 underline whitespace-nowrap"
								>
									Switch Network
								</a>
							)}
							<button
								onClick={() => setIsDismissed(true)}
								className="p-1 hover:bg-amber-500/20 rounded-lg transition-colors"
								aria-label="Dismiss banner"
							>
								<svg
									className="w-4 h-4 text-amber-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default TestnetBanner
