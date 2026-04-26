import { useQuery } from "@tanstack/react-query"
import { useWallet } from "./useWallet"

export type LinkedWalletInfo = { address: string; isPrimary: boolean }

export interface LearnerProfile {
	address: string
	/** Stellar keys tied to the same app account; primary is the canonical id. */
	wallets: LinkedWalletInfo[]
}

/**
 * Fetches the authenticated learner's profile from GET /api/me.
 * Returns the profile data (currently just wallet address, but extensible).
 * Automatically disabled if no wallet is connected.
 */
export function useLearnerProfile() {
	const { address } = useWallet()

	const { data, isLoading, error } = useQuery<LearnerProfile>({
		queryKey: ["learnerProfile", address],
		queryFn: async () => {
			if (!address) {
				throw new Error("No wallet address available")
			}

			const response = await fetch("/api/me", {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
				},
			})

			if (!response.ok) {
				const error = await response.json().catch(() => ({}))
				throw new Error(error.error || "Failed to fetch learner profile")
			}

			const json = (await response.json()) as LearnerProfile & { wallets?: LinkedWalletInfo[] }
			const wallets = Array.isArray(json.wallets) && json.wallets.length > 0
				? json.wallets
				: [{ address: json.address, isPrimary: true }]
			return { address: json.address, wallets }
		},
		enabled: !!address,
		staleTime: 5 * 60 * 1000, // 5 minutes
		retry: 1,
	})

	return {
		profile: data,
		isLoading,
		error: error instanceof Error ? error.message : null,
		address,
	}
}
