import { motion, AnimatePresence } from "framer-motion"
import { useState, useId } from "react"
import { useWallet } from "../hooks/useWallet"
import { stellarNetwork } from "../contracts/util"

export interface AddressDisplayProps {
	address?: string | null
	className?: string
	addressClassName?: string
	buttonClassName?: string
	prefixLength?: number
	suffixLength?: number
	showCopyButton?: boolean
	showExplorerLink?: boolean
	fullOnHover?: boolean
}

export function truncateAddress(
	address: string,
	prefixLength = 6,
	suffixLength = 4,
): string {
	if (!address) return ""
	if (address.length <= prefixLength + suffixLength + 3) return address
	return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`
}

export const AddressDisplay: React.FC<AddressDisplayProps> = ({
	address,
	className = "",
	addressClassName = "",
	buttonClassName = "",
	prefixLength = 6,
	suffixLength = 4,
	showCopyButton = true,
	showExplorerLink = true,
	fullOnHover = true,
}) => {
	const [copied, setCopied] = useState(false)
	const [isHovered, setIsHovered] = useState(false)
	const { network: walletNetwork } = useWallet()
	const tooltipId = useId()

	if (!address) return null

	const truncated = truncateAddress(address, prefixLength, suffixLength)

	const handleCopy = async (e: React.MouseEvent) => {
		e.stopPropagation()
		try {
			await navigator.clipboard.writeText(address)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch (err) {
			console.error("Failed to copy:", err)
		}
	}

	const getExplorerUrl = () => {
		const activeNetwork = (walletNetwork || stellarNetwork).toLowerCase()
		const baseUrl = activeNetwork.includes("public") || activeNetwork.includes("mainnet")
			? "https://stellar.expert/explorer/public/account/"
			: activeNetwork.includes("futurenet")
			? "https://futurenet.stellar.expert/explorer/futurenet/account/"
			: "https://testnet.stellar.expert/explorer/testnet/account/"
		return `${baseUrl}${address}`
	}

	return (
		<div 
			className={`inline-flex items-center gap-2 group/addr ${className}`}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<div className="relative flex items-center">
				<motion.span
					layout
					className={`font-mono text-sm cursor-help select-all ${addressClassName}`}
					title={address}
				>
					{fullOnHover && isHovered ? address : truncated}
				</motion.span>
				
				<AnimatePresence>
					{isHovered && !fullOnHover && (
						<motion.div
							initial={{ opacity: 0, y: 5 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 5 }}
							className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-900 text-white text-xs rounded-lg shadow-xl border border-white/10 whitespace-nowrap z-50 pointer-events-none"
						>
							{address}
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			{showCopyButton && (
				<motion.button
					whileHover={{ scale: 1.1 }}
					whileTap={{ scale: 0.9 }}
					onClick={handleCopy}
					className={`p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors relative ${buttonClassName}`}
					aria-label="Copy address"
				>
					<AnimatePresence mode="wait">
						{copied ? (
							<motion.svg
								key="check"
								initial={{ scale: 0.5, opacity: 0 }}
								animate={{ scale: 1, opacity: 1 }}
								exit={{ scale: 0.5, opacity: 0 }}
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="3"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="w-3.5 h-3.5 text-green-400"
							>
								<polyline points="20 6 9 17 4 12" />
							</motion.svg>
						) : (
							<motion.svg
								key="copy"
								initial={{ scale: 0.5, opacity: 0 }}
								animate={{ scale: 1, opacity: 1 }}
								exit={{ scale: 0.5, opacity: 0 }}
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="w-3.5 h-3.5 text-white/50 group-hover/addr:text-white"
							>
								<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
								<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
							</motion.svg>
						)}
					</AnimatePresence>
				</motion.button>
			)}

			{showExplorerLink && (
				<motion.a
					whileHover={{ scale: 1.1 }}
					href={getExplorerUrl()}
					target="_blank"
					rel="noopener noreferrer"
					className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-white/50 hover:text-brand-cyan"
					title="View on Stellar Expert"
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="w-3.5 h-3.5"
					>
						<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
						<polyline points="15 3 21 3 21 9" />
						<line x1="10" y1="14" x2="21" y2="3" />
					</svg>
				</motion.a>
			)}
		</div>
	)
}

export default AddressDisplay
