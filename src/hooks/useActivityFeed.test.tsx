import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useActivityFeed } from "./useActivityFeed"

const mockFetch = vi.fn()
global.fetch = mockFetch

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				gcTime: 0,
			},
		},
	})

	return function Wrapper({ children }: { children: React.ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		)
	}
}

const backendEvents = [
	{
		id: 1,
		contract: "C1",
		event_type: "LearnToken::Mint",
		data: { amount: "10" },
		ledger_sequence: "1",
		created_at: "2026-01-01T00:00:00Z",
		tx_hash: "tx1",
	},
	{
		id: 2,
		contract: "C1",
		event_type: "Course::Enroll",
		data: { courseId: "stellar-101" },
		ledger_sequence: "2",
		created_at: "2026-01-02T00:00:00Z",
		tx_hash: "tx2",
	},
	{
		id: 3,
		contract: "C1",
		event_type: "Governance::Vote",
		data: { proposalId: 7 },
		ledger_sequence: "3",
		created_at: "2026-01-03T00:00:00Z",
		tx_hash: "tx3",
	},
]

beforeEach(() => {
	vi.clearAllMocks()
	mockFetch.mockResolvedValue({
		ok: true,
		json: async () => ({ data: backendEvents }),
	})
})

describe("useActivityFeed", () => {
	it("returns paginated activity items", async () => {
		const { result } = renderHook(() => useActivityFeed("GABC", 2, "all"), {
			wrapper: createWrapper(),
		})

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.events).toHaveLength(2)
		expect(result.current.events[0].id).toBe("1")
		expect(result.current.events[1].id).toBe("2")
	})

	it("filters by activity type", async () => {
		renderHook(() => useActivityFeed("GABC", 10, "deposit"), {
			wrapper: createWrapper(),
		})

		await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))

		const calledUrl = String(mockFetch.mock.calls[0][0])
		expect(calledUrl).toContain("/api/events?")
		expect(calledUrl).toContain("type=LearnToken%3A%3AMint")
	})

	it("returns loading state", async () => {
		let resolveFetch: ((value: unknown) => void) | undefined
		mockFetch.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveFetch = resolve
				}),
		)

		const { result } = renderHook(() => useActivityFeed("GABC"), {
			wrapper: createWrapper(),
		})

		expect(result.current.isLoading).toBe(true)

		resolveFetch?.({
			ok: true,
			json: async () => ({ data: backendEvents }),
		})

		await waitFor(() => expect(result.current.isLoading).toBe(false))
	})

	it("loadMore appends next page", async () => {
		const { result } = renderHook(() => useActivityFeed("GABC", 2, "all"), {
			wrapper: createWrapper(),
		})

		await waitFor(() => expect(result.current.isLoading).toBe(false))
		expect(result.current.events).toHaveLength(2)

		act(() => {
			result.current.loadMore()
		})

		expect(result.current.events).toHaveLength(3)
	})

	it("hasMore flag is correct", async () => {
		const { result } = renderHook(() => useActivityFeed("GABC", 2, "all"), {
			wrapper: createWrapper(),
		})

		await waitFor(() => expect(result.current.isLoading).toBe(false))
		expect(result.current.hasMore).toBe(true)

		const second = renderHook(() => useActivityFeed("GABC", 3, "all"), {
			wrapper: createWrapper(),
		})
		await waitFor(() => expect(second.result.current.isLoading).toBe(false))
		expect(second.result.current.hasMore).toBe(false)
	})

	it("handles error gracefully", async () => {
		mockFetch.mockRejectedValue(new Error("network down"))

		const { result } = renderHook(() => useActivityFeed("GABC"), {
			wrapper: createWrapper(),
		})

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.error).toBe("Failed to load activity")
		expect(result.current.events).toHaveLength(0)
		expect(result.current.hasMore).toBe(false)
	})
})
