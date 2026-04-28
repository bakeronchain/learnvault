import { useQuery } from "@tanstack/react-query"

export interface ScholarProfile {
	address: string
	lrn_balance: string
	enrolled_courses: number
	completed_milestones: number
	pending_milestones: number
	credentials: any[]
	joined_at: string
	follower_count: number
	following_count: number
	is_following: boolean
}

export function useScholarProfile(address: string | undefined) {
	return useQuery<ScholarProfile>({
		queryKey: ["scholarProfile", address],
		queryFn: async () => {
			if (!address) throw new Error("Address is required")

			const response = await fetch(`/api/scholars/${address}`, {
				headers: {
					Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
				},
			})

			if (!response.ok) {
				const error = (await response.json().catch(() => ({}))) as {
					error?: string
				}
				throw new Error(error.error || "Failed to fetch scholar profile")
			}

			const data = await response.json()
			return data as ScholarProfile
		},
		enabled: !!address,
		staleTime: 30_000,
	})
}
