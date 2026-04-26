import {
	useNetwork,
	NETWORK_CONFIGS,
	type StellarNetwork,
} from "../providers/NetworkProvider"

export function NetworkSwitcher() {
	const {
		network,
		config,
		switchNetwork,
		canSwitchNetwork,
		availableNetworks,
	} = useNetwork()

	const handleNetworkChange = (newNetwork: StellarNetwork) => {
		if (newNetwork !== network) {
			switchNetwork(newNetwork)
		}
	}

	return (
		<div className="glass-card p-6 rounded-2xl border border-white/10">
			<div className="flex items-center justify-between mb-4">
				<div>
					<h3 className="text-lg font-semibold text-white">Network Settings</h3>
					<p className="text-sm text-white/50 mt-1">
						Select the Stellar network to connect to
					</p>
				</div>
				{!canSwitchNetwork && (
					<span className="px-3 py-1 bg-slate-500/20 text-slate-400 text-xs rounded-full border border-slate-500/30">
						Production Build
					</span>
				)}
			</div>

			<div className="space-y-3">
				{availableNetworks.map((netId) => {
					const netConfig = NETWORK_CONFIGS[netId]
					const isSelected = netId === network

					return (
						<button
							key={netId}
							onClick={() => handleNetworkChange(netId)}
							disabled={!canSwitchNetwork && !netConfig.isProduction}
							className={`
								w-full flex items-center justify-between p-4 rounded-xl border transition-all
								${
									isSelected
										? "bg-brand-cyan/10 border-brand-cyan/30"
										: "bg-white/5 border-white/10 hover:bg-white/10"
								}
								${!canSwitchNetwork && !netConfig.isProduction ? "opacity-50 cursor-not-allowed" : ""}
							`}
						>
							<div className="flex items-center gap-3">
								<div
									className={`
										w-3 h-3 rounded-full
										${netId === "PUBLIC" ? "bg-emerald-400" : ""}
										${netId === "TESTNET" ? "bg-amber-400" : ""}
										${netId === "FUTURENET" ? "bg-purple-400" : ""}
										${netId === "LOCAL" ? "bg-blue-400" : ""}
										${isSelected ? "animate-pulse" : ""}
									`}
								/>
								<div className="text-left">
									<div className="font-medium text-white">{netConfig.name}</div>
									<div className="text-xs text-white/50 font-mono">
										{netConfig.passphrase}
									</div>
								</div>
							</div>
							{isSelected && (
								<span className="px-2 py-1 bg-brand-cyan/20 text-brand-cyan text-xs rounded-full">
									Active
								</span>
							)}
						</button>
					)
				})}
			</div>

			{/* Current Network Details */}
			<div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10">
				<h4 className="text-sm font-medium text-white mb-3">
					Current Network Details
				</h4>
				<div className="space-y-2 text-sm">
					<div className="flex justify-between">
						<span className="text-white/50">Network:</span>
						<span className="text-white font-mono">{config.name}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-white/50">RPC URL:</span>
						<span className="text-white/70 font-mono text-xs truncate max-w-[200px]">
							{config.rpcUrl}
						</span>
					</div>
					<div className="flex justify-between">
						<span className="text-white/50">Horizon URL:</span>
						<span className="text-white/70 font-mono text-xs truncate max-w-[200px]">
							{config.horizonUrl}
						</span>
					</div>
					<div className="flex justify-between">
						<span className="text-white/50">Explorer:</span>
						<a
							href={config.explorerUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-brand-cyan hover:underline text-xs"
						>
							View Explorer →
						</a>
					</div>
				</div>
			</div>

			{/* Warning for testnet */}
			{!config.isProduction && (
				<div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
					<p className="text-sm text-amber-200/80">
						<strong className="text-amber-200">Warning:</strong> You are on a
						test network. Tokens have no real value and transactions are for
						testing only.
					</p>
				</div>
			)}
		</div>
	)
}

export default NetworkSwitcher
