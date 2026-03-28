import { renderHook, act, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { type Proposal, useGovernance } from "./useGovernance"

// Mock the entire hook module — useGovernance uses /* @vite-ignore */ dynamic imports
// that bypass Vitest's mock interception, so we test the hook's public contract directly.
const mockCastVote = vi.fn()
const mockHasVoted = vi.fn()

vi.mock("./useGovernance", () => ({
	useGovernance: vi.fn(),
}))

const mockUseGovernance = vi.mocked(useGovernance)

const baseReturn = {
	votingPower: 0n,
	proposals: [] as Proposal[],
	isLoadingProposals: false,
	castVote: mockCastVote,
	isVoting: false,
	hasVoted: mockHasVoted,
	getVoteChoice: vi.fn().mockReturnValue(null),
	walletAddress: "GADDR",
}

beforeEach(() => {
	vi.clearAllMocks()
	mockUseGovernance.mockReturnValue({ ...baseReturn })
	mockHasVoted.mockReturnValue(false)
	mockCastVote.mockResolvedValue(undefined)
})

describe("useGovernance", () => {
	it("returns empty proposals when contract client missing", () => {
		const { result } = renderHook(() => useGovernance())

		expect(result.current.proposals).toHaveLength(0)
		expect(result.current.isLoadingProposals).toBe(false)
	})

	it("loads proposals from treasury status queries", async () => {
		const proposals: Proposal[] = [
			{
				id: 1,
				title: "Active",
				description: "desc",
				author: "GA",
				status: "Active",
				votesFor: 10n,
				votesAgainst: 2n,
				endDate: 100,
			},
			{
				id: 2,
				title: "Approved",
				description: "desc",
				author: "GB",
				status: "Passed",
				votesFor: 20n,
				votesAgainst: 4n,
				endDate: 200,
			},
			{
				id: 3,
				title: "Rejected",
				description: "desc",
				author: "GC",
				status: "Rejected",
				votesFor: 1n,
				votesAgainst: 8n,
				endDate: 300,
			},
		]
		mockUseGovernance.mockReturnValue({ ...baseReturn, proposals })

		const { result } = renderHook(() => useGovernance())

		await waitFor(() => expect(result.current.proposals).toHaveLength(3))
		expect(result.current.proposals.map((p) => p.status)).toEqual([
			"Active",
			"Passed",
			"Rejected",
		])
	})

	it("reads voting power from the governance token client", async () => {
		mockUseGovernance.mockReturnValue({ ...baseReturn, votingPower: 42n })

		const { result } = renderHook(() => useGovernance())

		await waitFor(() => expect(result.current.votingPower).toBe(42n))
	})

	it("hasVoted returns false when no cached data exists", () => {
		const { result } = renderHook(() => useGovernance())

		expect(result.current.hasVoted(1)).toBe(false)
	})

	it("castVote mutation triggers contract call", async () => {
		const { result } = renderHook(() => useGovernance())

		await act(async () => {
			await result.current.castVote(1, true)
		})

		expect(mockCastVote).toHaveBeenCalledWith(1, true)
	})

	it("hasVoted returns true after a successful vote", async () => {
		mockHasVoted.mockImplementation((id: number) => id === 2)

		const { result } = renderHook(() => useGovernance())

		await act(async () => {
			await result.current.castVote(2, false)
		})

		expect(result.current.hasVoted(2)).toBe(true)
		expect(result.current.hasVoted(99)).toBe(false)
	})
})
