import { renderHook, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { useAdminContracts } from "../useAdminContracts"
import * as sorobanAdmin from "../../util/sorobanAdmin"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"

vi.mock("../../util/sorobanAdmin", () => ({
	getCourseMilestoneState: vi.fn(),
	getScholarshipTreasuryState: vi.fn(),
	invokeContractMethod: vi.fn(),
}))

vi.mock("../useContractIds", () => ({
	useContractIds: () => ({
		learnToken: "L1",
		scholarshipTreasury: "T1",
	}),
}))

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: false,
		},
	},
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
	<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

describe("useAdminContracts", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		queryClient.clear()
	})

	it("fetches contract states", async () => {
		vi.mocked(sorobanAdmin.getScholarshipTreasuryState).mockResolvedValue({
			contractId: "T1",
			paused: false,
		})
		vi.mocked(sorobanAdmin.getCourseMilestoneState).mockResolvedValue(null as any)

		const { result } = renderHook(() => useAdminContracts(), { wrapper })

		await waitFor(() => expect(result.current.isSuccess).toBe(true))

		expect(result.current.data?.scholarshipTreasuryState?.paused).toBe(false)
		expect(result.current.data?.registry).toContainEqual(expect.objectContaining({ key: "scholarshipTreasury" }))
	})
})
