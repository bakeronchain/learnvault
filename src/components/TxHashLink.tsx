import React from "react"

interface TxHashLinkProps {
	hash: string
	className?: string
	network?: "testnet" | "public"
}

const truncateTxHash = (hash: string) => {
	if (hash.length <= 12) return hash
	return `${hash.slice(0, 8)}...${hash.slice(-4)}`
}

const TxHashLink: React.FC<TxHashLinkProps> = ({
	hash,
	className = "",
	network = "testnet",
}) => {
	const href = `https://stellar.expert/explorer/${network}/tx/${hash}`

	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			title={hash}
			aria-label={`View transaction ${hash} on Stellar Expert`}
			className={className}
		>
			{truncateTxHash(hash)} ↗
		</a>
	)
}

export default TxHashLink
