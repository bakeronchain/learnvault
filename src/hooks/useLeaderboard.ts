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
}

export async function fetchLeaderboard(
	address?: string,
): Promise<LeaderboardData> {
	const response = await fetch(
		`${API_URL}/api/scholars/leaderboard${address ? `?viewer_address=${address}` : ""}`,
	)
	if (!response.ok) throw new Error("Failed to fetch leaderboard")
	return (await response.json()) as LeaderboardData
}

export function useLeaderboard(address?: string) {
	return useQuery({
		queryKey: ["leaderboard", address],
		queryFn: () => fetchLeaderboard(address),
		staleTime: 300 * 1000, // 5 minutes
	})
}
