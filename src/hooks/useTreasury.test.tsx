import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useTreasury } from "./useTreasury"

const mockFetch = vi.fn()
global.fetch = mockFetch

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	})

	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		)
	}
}

beforeEach(() => {
	vi.clearAllMocks()

	mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
		const url = String(input)

		if (url.includes("/treasury/stats")) {
			return {
				ok: true,
				json: async () => ({
					total_deposited_usdc: "10000000",
					total_disbursed_usdc: "2500000",
					scholars_funded: 3,
					active_proposals: 1,
					donors_count: 5,
				}),
			} as Response
		}

		if (url.includes("/treasury/allocations")) {
			return {
				ok: true,
				json: async () => ({
					idle_usdc: "7500000",
					allocated_usdc: "2500000",
					accrued_yield: "1250000",
					total_yield: "5000000",
					venue: {
						address: "CAFKXZCE4LYBELT24RAT2VCS4SJ2JO7Y26H54QHMBO3P5VG2OQ5VLYU3",
						name: "LearnVault Lending Market",
					},
					events: [
						{
							type: "allocated",
							strategy: "CAFKXZCE4LYBELT24RAT2VCS4SJC4SJ2JO7Y26H54QHMBO3P5VG2OQ5VLYU3",
							amount: "2500000",
							tx_hash: "tx1",
							created_at: "2026-05-01T00:00:00Z",
						},
					],
				}),
			} as Response
		}

		if (url.includes("/treasury/activity")) {
			return {
				ok: true,
				json: async () => ({
					data: [
						{
							type: "deposit",
							amount: "10000000",
							tx_hash: "tx1",
							created_at: "2026-05-01T00:00:00Z",
						},
					],
					pagination: { page: 1, limit: 10, total: 1 },
				}),
			} as Response
		}

		return { ok: true, json: async () => ({}) } as Response
	})
})

describe("useTreasury", () => {
	it("returns treasury stats and activity", async () => {
		const { result } = renderHook(() => useTreasury(), {
			wrapper: createWrapper(),
		})

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.stats).toBeDefined()
		expect(result.current.stats?.total_deposited_usdc).toBe("10000000")
		expect(result.current.activity.length).toBeGreaterThan(0)
		expect(result.current.isError).toBe(false)
	})

	it("returns the idle/allocated/yield breakdown and venue", async () => {
		const { result } = renderHook(() => useTreasury(), {
			wrapper: createWrapper(),
		})

		await waitFor(() => expect(result.current.isAllocationsLoading).toBe(false))

		expect(result.current.allocations).toBeDefined()
		expect(result.current.allocations?.idle_usdc).toBe("7500000")
		expect(result.current.allocations?.allocated_usdc).toBe("2500000")
		expect(result.current.allocations?.accrued_yield).toBe("1250000")
		expect(result.current.allocations?.total_yield).toBe("5000000")
		expect(result.current.allocations?.venue.name).toBe("LearnVault Lending Market")
		expect(result.current.allocations?.events[0].type).toBe("allocated")
	})

	it("polls for updates at configured interval", async () => {
		vi.useFakeTimers()

		let callCountAtLoad = 0

		const { result } = renderHook(() => useTreasury(), {
			wrapper: createWrapper(),
		})

		await waitFor(() => expect(result.current.isLoading).toBe(false))
		callCountAtLoad = mockFetch.mock.calls.length

		// advance by the hook's refetch interval (60_000ms)
		vi.advanceTimersByTime(60_000)

		// wait for the refetch to complete
		await waitFor(() =>
			expect(mockFetch.mock.calls.length).toBeGreaterThan(callCountAtLoad),
		)

		vi.useRealTimers()
	})

	it("keeps last-known data when a subsequent fetch errors", async () => {
		// initial successful response provided by beforeEach
		const { result } = renderHook(() => useTreasury(), {
			wrapper: createWrapper(),
		})

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		// now make subsequent stats fetch fail
		mockFetch.mockImplementationOnce(async (input: RequestInfo | URL) => {
			const url = String(input)
			if (url.includes("/treasury/stats")) {
				return { ok: false } as Response
			}
			return { ok: true, json: async () => ({ events: [] }) } as Response
		})

		// trigger refetch
		await waitFor(() => {
			result.current.refetch()
			return true
		})

		// after the failed refetch, isError should be true but stats should still be present
		await waitFor(() => expect(result.current.isError).toBe(true))
		expect(result.current.stats).toBeDefined()
		expect(typeof result.current.stats?.total_deposited_usdc).toBe("string")
	})
})
