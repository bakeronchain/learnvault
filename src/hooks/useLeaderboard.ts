import { useQuery } from "@tanstack/react-query"
import { API_URL } from "../lib/api"

export type LeaderboardApiEntry = {
	rank: number
	address: string
	lrn_balance: string
	courses_completed: number
}

export interface LeaderboardData {
	rankings?: LeaderboardApiEntry[]
	your_rank?: number | null
	total?: number
}

export async function fetchLeaderboard(
	address?: string,
	page = 1,
	limit = 10,
): Promise<LeaderboardData> {
	const params = new URLSearchParams()
	params.set("page", String(page))
	params.set("limit", String(limit))
	if (address) {
		params.set("viewer_address", address)
	}

	const response = await fetch(
		`${API_URL}/api/scholars/leaderboard?${params.toString()}`,
	)
	if (!response.ok) throw new Error("Failed to fetch leaderboard")
	return (await response.json()) as LeaderboardData
}

export function useLeaderboard(address?: string, page = 1, limit = 10) {
	return useQuery({
		queryKey: ["leaderboard", address, page, limit],
		queryFn: () => fetchLeaderboard(address, page, limit),
		staleTime: 300 * 1000, // 5 minutes
	})
}
