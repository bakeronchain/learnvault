import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
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
	const queryClient = useQueryClient()
	const queryKey = ["leaderboard", address]

	const query = useQuery({
		queryKey,
		queryFn: () => fetchLeaderboard(address),
		staleTime: 300 * 1000, // 5 minutes
	})

	useEffect(() => {
		// Subscribe to real-time updates via SSE
		const streamUrl = new URL(`${API_URL}/api/leaderboard/stream`)
		if (address) {
			streamUrl.searchParams.append("viewer_address", address)
		}

		const eventSource = new EventSource(streamUrl.toString())

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data) as LeaderboardData
				// Update the query cache with fresh data from SSE
				queryClient.setQueryData(["leaderboard", address], data)
			} catch (err) {
				console.error("[SSE] Failed to parse leaderboard update:", err)
			}
		}

		eventSource.onerror = (err) => {
			console.error("[SSE] Leaderboard stream error:", err)
			eventSource.close()

			// Simple fallback: invalidate query
			setTimeout(() => {
				void queryClient.invalidateQueries({
					queryKey: ["leaderboard", address],
				})
			}, 5000)
		}

		return () => {
			eventSource.close()
		}
	}, [address, queryClient])

	return query
}
