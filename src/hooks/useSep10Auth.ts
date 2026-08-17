import { WebAuth } from "@stellar/stellar-sdk"
import { useState } from "react"
import { buildApiUrl } from "../lib/auth"
import { setAuthSession } from "../util/auth"

type Sep10AuthState = {
	isAuthenticating: boolean
	error: string | null
}

/**
 * Hook that implements SEP-10 Stellar Web Authentication.
 *
 * Flow:
 * 1. Fetch challenge from server
 * 2. Sign the challenge transaction with the connected wallet
 * 3. Submit the signed XDR back to the server for verification
 * 4. Receive and store the JWT
 */
export function useSep10Auth() {
	const [state, setState] = useState<Sep10AuthState>({
		isAuthenticating: false,
		error: null,
	})

	const authenticate = async (
		address: string,
		signTransaction: (
			xdr: string,
			opts?: { networkPassphrase?: string; address?: string },
		) => Promise<{ signedTxXdr: string; signerAddress?: string }>,
		networkPassphrase?: string,
	): Promise<boolean> => {
		setState({ isAuthenticating: true, error: null })

		try {
			// 1. Fetch challenge from server
			const challengeUrl = buildApiUrl(
				`/api/auth/sep10?account=${encodeURIComponent(address)}`,
			)
			const challengeRes = await fetch(challengeUrl)

			if (!challengeRes.ok) {
				const body = await challengeRes.json().catch(() => null)
				throw new Error(
					body?.error ?? `Failed to fetch challenge: ${challengeRes.status}`,
				)
			}

			const { transaction, network_passphrase } = await challengeRes.json()

			// 2. Sign the challenge transaction with the wallet
			const { signedTxXdr } = await signTransaction(transaction, {
				networkPassphrase: networkPassphrase ?? network_passphrase,
				address,
			})

			// 3. Submit the signed XDR to the server
			const verifyUrl = buildApiUrl("/api/auth/sep10")
			const verifyRes = await fetch(verifyUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ transaction: signedTxXdr }),
			})

			if (!verifyRes.ok) {
				const body = await verifyRes.json().catch(() => null)
				throw new Error(
					body?.error ?? `Authentication failed: ${verifyRes.status}`,
				)
			}

			const { token, refreshToken } = await verifyRes.json()

			// 4. Store the JWT
			setAuthSession(token, refreshToken)

			setState({ isAuthenticating: false, error: null })
			return true
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Authentication failed"
			setState({ isAuthenticating: false, error: message })
			return false
		}
	}

	return {
		...state,
		authenticate,
	}
}
