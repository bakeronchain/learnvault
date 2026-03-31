import { useQuery } from "@tanstack/react-query"

export interface TreasuryStats {
	total_deposited_usdc: string
	total_disbursed_usdc: string
	scholars_funded: number
	active_proposals: number
	donors_count: number
}

export interface TreasuryEvent {
	type: "deposit" | "disburse"
	amount?: string
	address?: string
	scholar?: string
	tx_hash: string
	created_at: string
}

const API_BASE =
	(import.meta.env.VITE_API_BASE_URL as string | undefined) ||
	(import.meta.env.VITE_SERVER_URL as string | undefined) ||
	"/api"

async function fetchTreasuryStats(): Promise<TreasuryStats> {
	const response = await fetch(`${API_BASE}/treasury/stats`)
	if (!response.ok) {
		throw new Error("Failed to load treasury stats")
	}
	const data = (await response.json()) as TreasuryStats
	return data
}

async function fetchTreasuryActivity(): Promise<TreasuryEvent[]> {
	const response = await fetch(`${API_BASE}/treasury/activity?limit=20`)
	if (!response.ok) {
		throw new Error("Failed to load treasury activity")
	}
	const data = (await response.json()) as { events?: TreasuryEvent[] }
	return data.events ?? []
}

export function useTreasury() {
	const {
		data: stats,
		isLoading: isStatsLoading,
		error: statsError,
		refetch: refetchStats,
	} = useQuery({
		queryKey: ["treasury", "stats"],
		queryFn: fetchTreasuryStats,
		staleTime: 30_000,
		refetchInterval: 60_000,
	})

	const {
		data: activity,
		isLoading: isActivityLoading,
		error: activityError,
		refetch: refetchActivity,
	} = useQuery({
		queryKey: ["treasury", "activity"],
		queryFn: fetchTreasuryActivity,
		staleTime: 30_000,
		refetchInterval: 60_000,
	})

	return {
		stats,
		activity: activity ?? [],
		isLoading: isStatsLoading || isActivityLoading,
		isError: Boolean(statsError || activityError),
		refetch: () => {
			refetchStats()
			refetchActivity()
		},
	}
}
