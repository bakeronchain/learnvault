import { useInfiniteQuery, useQuery } from "@tanstack/react-query"

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

export async function fetchTreasuryStats(): Promise<TreasuryStats> {
	const response = await fetch(`${API_BASE}/treasury/stats`)
	if (!response.ok) {
		throw new Error("Failed to load treasury stats")
	}
	const data = (await response.json()) as TreasuryStats
	return data
}

export async function fetchTreasuryActivityPage(
	limit: number,
	offset: number,
): Promise<TreasuryEvent[]> {
	const response = await fetch(
		`${API_BASE}/treasury/activity?limit=${limit}&offset=${offset}`,
	)
	if (!response.ok) {
		throw new Error("Failed to load treasury activity")
	}
	const data = (await response.json()) as { events?: TreasuryEvent[] }
	return data.events ?? []
}

export function useTreasury() {
	const activityPageSize = 10
	const {
		data: stats,
		isLoading: isStatsLoading,
		error: statsError,
		refetch: refetchStats,
	} = useQuery({
		queryKey: ["treasury", "stats"],
		queryFn: fetchTreasuryStats,
		staleTime: 60 * 1000,
		refetchInterval: 60_000,
	})

	const activityQuery = useInfiniteQuery({
		queryKey: ["treasury", "activity"],
		queryFn: ({ pageParam }) =>
			fetchTreasuryActivityPage(activityPageSize, pageParam as number),
		initialPageParam: 0,
		getNextPageParam: (lastPage, pages) => {
			if (lastPage.length < activityPageSize) return undefined
			return pages.length * activityPageSize
		},
		staleTime: 60 * 1000,
		refetchInterval: 60_000,
	})

	const activity = activityQuery.data?.pages.flat() ?? []

	return {
		stats,
		activity,
		isLoading: isStatsLoading || activityQuery.isLoading,
		isError: Boolean(statsError || activityQuery.error),
		hasMoreActivity: activityQuery.hasNextPage,
		isLoadingMoreActivity: activityQuery.isFetchingNextPage,
		loadMoreActivity: () => {
			void activityQuery.fetchNextPage()
		},
		refetch: () => {
			void refetchStats()
			void activityQuery.refetch()
		},
	}
}
