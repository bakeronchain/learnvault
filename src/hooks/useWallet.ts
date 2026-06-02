import { use } from "react"
import { WalletContext } from "../providers/WalletProvider"

/**
 * Provides wallet connection state and actions for the connected Stellar wallet.
 *
 * @returns
 * - `address` — The connected wallet's public key, or `undefined` if not connected
 * - `balances` — Array of token balances for the connected account
 * - `isConnected` — Whether a wallet is currently connected
 * - `connect` — Opens the wallet selector modal
 * - `disconnect` — Clears the wallet connection
 * - `signTransaction` — Signs a Soroban transaction XDR with the connected wallet
 * - `updateBalances` — Manually re-fetches balances from Horizon
 * - `network` — The current Stellar network (LOCAL, TESTNET, etc.)
 */
export function useWallet() {
	// Consumes the WalletContext using the modern React 'use' hook
	const ctx = use(WalletContext)

	// Throw a helpful error if the hook is used outside of its required Provider
	if (!ctx) {
		throw new Error("useWallet must be used within a WalletProvider")
	}

	return ctx
}
