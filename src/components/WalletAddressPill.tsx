import React from "react"
import AddressDisplay from "./AddressDisplay"

interface Props {
	address: string
	showLink?: boolean
}

export const WalletAddressPill = ({ address, showLink = true }: Props) => {
	return (
		<AddressDisplay 
			address={address} 
			showExplorerLink={showLink}
			className="glass px-3 py-1.5 rounded-full border border-white/10"
			addressClassName="text-xs font-mono font-medium text-white/70"
		/>
	)
}
