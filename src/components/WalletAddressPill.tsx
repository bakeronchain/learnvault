import { Icon } from "@stellar/design-system"
import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"
import { stellarNetwork } from "../contracts/util"

import { useWallet } from "../hooks/useWallet"
import { shortenAddress } from "../util/contract"

interface Props {
	address: string
	showLink?: boolean
}

export const WalletAddressPill = ({ address, showLink = false }: Props) => {
	const { network: walletNetwork } = useWallet()
	const [copied, setCopied] = useState(false)

	const copyToClipboard = async (e: React.MouseEvent) => {
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

		if (activeNetwork === "public" || activeNetwork === "mainnet") {
			return `https://stellar.expert/explorer/public/account/${address}`
		}

		if (activeNetwork === "futurenet") {
			return `https://futurenet.stellar.expert/explorer/futurenet/account/${address}`
		}

		// Default to Testnet for everything else (TESTNET, LOCAL, etc.)
		return `https://testnet.stellar.expert/explorer/testnet/account/${address}`
	}

	return (
		<div className="flex items-center gap-2 group">
			<motion.button
				whileHover={{ scale: 1.02 }}
				whileTap={{ scale: 0.98 }}
				onClick={copyToClipboard}
				className="glass relative flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 hover:border-brand-cyan/30 transition-all group/pill cursor-pointer"
				title="Click to copy address"
			>
				<span className="text-xs font-mono font-medium text-white/70 group-hover/pill:text-brand-cyan transition-colors">
					{shortenAddress(address)}
				</span>

				<div className="flex items-center justify-center w-4 h-4 text-white/40 group-hover/pill:text-brand-cyan transition-colors">
					{/* I'll use a direct SVG for the copy icon to ensure it works regardless of specific package exports */}
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="w-3.5 h-3.5"
					>
						<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
						<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
					</svg>
				</div>

				<AnimatePresence>
					{copied && (
						<motion.div
							initial={{ opacity: 0, y: 10, scale: 0.8 }}
							animate={{ opacity: 1, y: -25, scale: 1 }}
							exit={{ opacity: 0, scale: 0.8 }}
							className="absolute left-1/2 -translateX-1/2 px-2 py-1 bg-brand-cyan text-black text-[10px] font-black uppercase tracking-tighter rounded-md shadow-lg pointer-events-none"
						>
							Copied!
						</motion.div>
					)}
				</AnimatePresence>
			</motion.button>

			{showLink && (
				<motion.a
					whileHover={{ scale: 1.1, color: "#00d2ff" }}
					href={getExplorerUrl()}
					target="_blank"
					rel="noopener noreferrer"
					className="text-white/30 hover:text-brand-cyan transition-colors"
					title="View on Stellar Expert"
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="w-4 h-4"
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
