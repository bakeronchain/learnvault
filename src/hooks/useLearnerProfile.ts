import { useQuery } from "@tanstack/react-query"

import { getAuthToken } from "../util/auth"
import { useWallet } from "./useWallet"

export type LinkedWalletEntry = {
	address: string
	isPrimary: boolean
}

export type MeCredential = {
	token_id: number
	course_id: string
	metadata_uri: string | null
	minted_at: string
	revoked: boolean
	scholar_address: string
}

export interface LearnerProfile {
	address: string
	primaryAddress: string
	linkedWallets: LinkedWalletEntry[]
	aggregated: {
		lrnBalance: string
		coursesCompleted: number
		nftCount: number
	}
	credentials: MeCredential[]
}

/**
 * Fetches the authenticated learner profile from GET /api/me (linked wallets + aggregates).
 * Disabled when no wallet or no auth token.
 */
export function useLearnerProfile() {
	const { address } = useWallet()

	const { data, isLoading, error, refetch } = useQuery<LearnerProfile>({
		queryKey: ["learnerProfile", address],
		queryFn: async () => {
			if (!address) {
				throw new Error("No wallet address available")
			}
			const token = getAuthToken()
			if (!token) {
				throw new Error("Not authenticated")
			}

			const response = await fetch("/api/me", {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
			})

			if (!response.ok) {
				const errBody = await response.json().catch(() => ({}))
				throw new Error(errBody.error || "Failed to fetch learner profile")
			}

			return response.json() as Promise<LearnerProfile>
		},
		enabled: !!address && !!getAuthToken(),
		staleTime: 60 * 1000,
		retry: 1,
	})

	return {
		profile: data,
		isLoading,
		error: error instanceof Error ? error.message : null,
		address,
		refetch,
	}
}
