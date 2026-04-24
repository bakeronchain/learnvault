import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("./useWallet", () => ({ useWallet: vi.fn() }))

import { useProposal, useProposals } from "./useProposals"
import { useWallet } from "./useWallet"

const mockUseWallet = vi.mocked(useWallet)
const mockFetch = vi.fn()
global.fetch = mockFetch

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
			mutations: {
				retry: false,
			},
		},
	})

	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		)
	}
}

describe("useProposals", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockUseWallet.mockReturnValue({
			address: "GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBFUKJQ2K5RQDDXYZ",
		} as ReturnType<typeof useWallet>)
		mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
			const url = String(input)
			if (url.includes("/api/proposals?")) {
				return {
					ok: true,
					json: async () => ({
						proposals: [
							{
								id: 4,
								author_address:
									"GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBFUKJQ2K5RQDDXYZ",
								title: "Fund mentors",
								description: "A proposal",
								amount: "250",
								votes_for: "9",
								votes_against: "3",
								status: "pending",
								deadline: "2099-01-01T00:00:00.000Z",
								created_at: "2026-03-28T10:00:00.000Z",
								user_vote_support: true,
							},
						],
						total: 1,
						page: 1,
					}),
				} as Response
			}

			if (url.includes("/voting-power/")) {
				return {
					ok: true,
					json: async () => ({ gov_balance: "1250000000" }),
				} as Response
			}

			if (url.includes("/api/proposals/4")) {
				return {
					ok: true,
					json: async () => ({
						id: 4,
						author_address:
							"GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBFUKJQ2K5RQDDXYZ",
						title: "Fund mentors",
						description: "A proposal",
						amount: "250",
						votes_for: "9",
						votes_against: "3",
						status: "pending",
						deadline: "2099-01-01T00:00:00.000Z",
						created_at: "2026-03-28T10:00:00.000Z",
						user_vote_support: true,
					}),
				} as Response
			}

			return {
				ok: true,
				json: async () => ({}),
			} as Response
		})
	})

	it("maps backend proposals into UI-safe proposal records", async () => {
		const { result } = renderHook(() => useProposals(), {
			wrapper: createWrapper(),
		})

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.proposals).toHaveLength(1)
		expect(result.current.proposals[0]?.displayStatus).toBe("Voting Open")
		expect(result.current.proposals[0]?.votesFor).toBe(9n)
		expect(result.current.proposals[0]?.userVoteSupport).toBe(true)
		expect(result.current.votingPower).toBe(1250000000n)
	})

	it("loads a proposal detail record", async () => {
		const { result } = renderHook(() => useProposal(4), {
			wrapper: createWrapper(),
		})

		await waitFor(() => expect(result.current.isSuccess).toBe(true))

		expect(result.current.data?.id).toBe(4)
		expect(result.current.data?.displayStatus).toBe("Voting Open")
	})
})
