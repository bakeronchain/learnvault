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

		if (url.includes("/treasury/activity")) {
			return {
				ok: true,
				json: async () => ({
					events: [
						{
							type: "deposit",
							amount: "10000000",
							tx_hash: "tx1",
							created_at: "2026-05-01T00:00:00Z",
						},
					],
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
		await waitFor(() => expect(mockFetch.mock.calls.length).toBeGreaterThan(callCountAtLoad))

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
