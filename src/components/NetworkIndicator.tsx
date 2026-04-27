import { useNetwork } from "../providers/NetworkProvider"

interface NetworkIndicatorProps {
	className?: string
	showLabel?: boolean
}

export function NetworkIndicator({
	className = "",
	showLabel = true,
}: NetworkIndicatorProps) {
	const { network, config, isTestnet } = useNetwork()

	const getNetworkColor = () => {
		switch (network) {
			case "PUBLIC":
				return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
			case "TESTNET":
				return "bg-amber-500/20 text-amber-400 border-amber-500/30"
			case "FUTURENET":
				return "bg-purple-500/20 text-purple-400 border-purple-500/30"
			case "LOCAL":
				return "bg-blue-500/20 text-blue-400 border-blue-500/30"
			default:
				return "bg-slate-500/20 text-slate-400 border-slate-500/30"
		}
	}

	const getNetworkDot = () => {
		switch (network) {
			case "PUBLIC":
				return "bg-emerald-400"
			case "TESTNET":
				return "bg-amber-400"
			case "FUTURENET":
				return "bg-purple-400"
			case "LOCAL":
				return "bg-blue-400"
			default:
				return "bg-slate-400"
		}
	}

	return (
		<div
			className={`
				inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium
				${getNetworkColor()}
				${className}
			`}
			title={`Connected to ${config.name}`}
		>
			<span
				className={`w-2 h-2 rounded-full ${getNetworkDot()} animate-pulse`}
			/>
			{showLabel && <span>{config.name}</span>}
		</div>
	)
}

export default NetworkIndicator
