import { useEffect, useRef } from "react"
import { useWallet } from "../hooks/useWallet"
import { useToast } from "./Toast/ToastProvider"

/**
 * Watches for wallet connect/disconnect events and fires toast notifications.
 * Must be rendered inside both WalletProvider and ToastProvider.
 */
export function WalletToastWatcher() {
	const { address, isPending } = useWallet()
	const { showSuccess, showInfo } = useToast()
	const prevAddressRef = useRef<string | undefined>(undefined)
	const initializedRef = useRef(false)

	useEffect(() => {
		// Wait for the initial wallet state restore to finish before tracking changes
		if (isPending) return

		if (!initializedRef.current) {
			initializedRef.current = true
			prevAddressRef.current = address
			return
		}

		const prev = prevAddressRef.current
		if (prev === address) return

		if (!prev && address) {
			showSuccess(
				`Wallet connected: ${address.slice(0, 4)}...${address.slice(-4)}`,
			)
		} else if (prev && !address) {
			showInfo("Wallet disconnected")
		}

		prevAddressRef.current = address
	}, [address, isPending, showSuccess, showInfo])

	return null
}
