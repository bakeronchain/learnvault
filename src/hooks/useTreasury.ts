import { useInfiniteQuery, useQuery } from "@tanstack/react-query"

export interface AssetBalance {
	asset: string
	symbol: string
	deposited: string
	usd_equivalent: string
}

export interface TreasuryStats {
	total_deposited_usdc: string
	total_disbursed_usdc: string
	scholars_funded: number
	active_proposals: number
	donors_count: number
	asset_balances: AssetBalance[]
}

export interface TreasuryEvent {
	type: "deposit" | "disburse"
	amount?: string
	asset?: string
	asset_symbol?: string
	address?: string
	scholar?: string
	tx_hash: string
	created_at: string
}

export type AllocationEventType =
	| "allocated"
	| "deallocated"
	| "harvested"
	| "emergency_withdraw"

export interface AllocationEvent {
	type: AllocationEventType
	strategy?: string
	amount?: string
	returned?: string
	yield_amount?: string
	tx_hash: string
	created_at: string
}

export interface VenueInfo {
	/** Strategy adapter contract address, or null when fully idle. */
	address: string | null
	/** Human-readable name of the venue holding allocated funds. */
	name: string
}

export interface TreasuryAllocations {
	idle_usdc: string
	allocated_usdc: string
	accrued_yield: string
	total_yield: string
	venue: VenueInfo
	events: AllocationEvent[]
}

const API_BASE =
	(import.meta.env.VITE_API_BASE_URL as string | undefined) ||
	(import.meta.env.VITE_SERVER_URL as string | undefined) ||
	"/api/v1"

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
	// The API returns { data: TreasuryEvent[], pagination }.
	const body = (await response.json()) as { data?: TreasuryEvent[] }
	return body.data ?? []
}

export async function fetchTreasuryAllocations(): Promise<TreasuryAllocations> {
	const response = await fetch(`${API_BASE}/treasury/allocations`)
	if (!response.ok) {
		throw new Error("Failed to load treasury allocations")
	}
	return (await response.json()) as TreasuryAllocations
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

	const allocationsQuery = useQuery({
		queryKey: ["treasury", "allocations"],
		queryFn: fetchTreasuryAllocations,
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
		allocations: allocationsQuery.data,
		isAllocationsLoading: allocationsQuery.isLoading,
		activity,
		isLoading: isStatsLoading || activityQuery.isLoading,
		isError: Boolean(
			statsError || activityQuery.error || allocationsQuery.error,
		),
		hasMoreActivity: activityQuery.hasNextPage,
		isLoadingMoreActivity: activityQuery.isFetchingNextPage,
		loadMoreActivity: () => {
			void activityQuery.fetchNextPage()
		},
		refetch: () => {
			void refetchStats()
			void allocationsQuery.refetch()
			void activityQuery.refetch()
		},
	}
}
