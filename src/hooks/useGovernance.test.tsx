import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ToastProvider } from "../components/Toast/ToastProvider"
import {
	WalletContext,
	type WalletContextType,
} from "../providers/WalletProvider"

const mockGetActiveProposals = vi.fn()
const mockGetProposalsByStatus = vi.fn()
const mockVote = vi.fn()
const mockBalanceFn = vi.fn()
const mockHasVoted = vi.fn()
const mockSignAndSend = vi.fn()

vi.stubEnv("PUBLIC_SCHOLARSHIP_TREASURY_CONTRACT", "0xMOCKSCHOLARSHIP")
vi.stubEnv("PUBLIC_GOVERNANCE_TOKEN_CONTRACT", "0xMOCKGOVTOKEN")

vi.mock("../contracts/util", () => ({
	rpcUrl: "http://localhost:8000/rpc",
	stellarNetwork: "LOCAL",
	networkPassphrase: "Test SDF Network ; September 2015",
}))

vi.mock("../contracts/scholarship_treasury", () => ({
	default: {
		get_active_proposals: (...args: unknown[]) =>
			mockGetActiveProposals(...args),
		get_proposals_by_status: (...args: unknown[]) =>
			mockGetProposalsByStatus(...args),
		vote: (...args: unknown[]) => mockVote(...args),
		has_voted: (...args: unknown[]) => mockHasVoted(...args),
	},
}))

vi.mock("../contracts/governance_token", () => ({
	default: {
		balance: (...args: unknown[]) => mockBalanceFn(...args),
	},
}))

const signTransaction = vi.fn()

const loadUseGovernance = async () => {
	const module = await import("./useGovernance")
	return module.useGovernance
}

function createWrapper(address?: string) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})

	const walletCtx: WalletContextType = {
		address,
		balances: {},
		isPending: false,
		isReconnecting: false,
		signTransaction,
		updateBalances: vi.fn(),
	}

	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(
				ToastProvider,
				null,
			ToastProvider,
			null,
			createElement(
				QueryClientProvider,
				{ client: queryClient },
				createElement(WalletContext.Provider, { value: walletCtx }, children),
			),
		)
	}
}

beforeEach(() => {
	vi.clearAllMocks()
	mockHasVoted.mockResolvedValue(false)
	mockBalanceFn.mockResolvedValue(0n)
	mockGetActiveProposals.mockResolvedValue([])
	mockGetProposalsByStatus.mockResolvedValue([])
	mockSignAndSend.mockResolvedValue({
		result: {
			isErr: () => false,
			unwrap: () => undefined,
		},
	})
	mockVote.mockResolvedValue({
		signAndSend: mockSignAndSend,
	})
})

describe("useGovernance", () => {
	it("loads proposals from treasury status queries", async () => {
		const useGovernance = await loadUseGovernance()

		mockGetActiveProposals.mockResolvedValue([
			{
				id: 1,
				program_name: "Active proposal",
				program_description: "Pending vote",
				applicant: "GACTIVE",
				yes_votes: 10,
				no_votes: 2,
				deadline_ledger: 100,
			},
		])
		mockGetProposalsByStatus.mockImplementation(async (status: unknown) => {
			if (status === "Approved") {
				return [
					{
						id: 2,
						program_name: "Approved proposal",
						program_description: "Passed vote",
						applicant: "GAPPROVED",
						yes_votes: 20,
						no_votes: 4,
						deadline_ledger: 200,
					},
				]
			}
			if (status === "Rejected") {
				return [
					{
						id: 3,
						program_name: "Rejected proposal",
						program_description: "Failed vote",
						applicant: "GREJECTED",
						yes_votes: 1,
						no_votes: 8,
						deadline_ledger: 300,
					},
				]
			}
			return []
		})

		const { result } = renderHook(() => useGovernance(), {
			wrapper: createWrapper("GADDR"),
		})

		await waitFor(() => {
			expect(result.current.proposals).toHaveLength(3)
		})

		expect(result.current.proposals.map((proposal) => proposal.status)).toEqual(
			["Active", "Passed", "Rejected"],
		)
		expect(result.current.proposals.map((proposal) => proposal.id)).toEqual([
			1, 2, 3,
		])
	})

	it("reads voting power from the governance token client", async () => {
		const useGovernance = await loadUseGovernance()
		mockBalanceFn.mockResolvedValue(42n)

		const { result } = renderHook(() => useGovernance(), {
			wrapper: createWrapper("GADDR"),
		})

		await waitFor(() => {
			expect(result.current.votingPower).toBe(42n)
		})
	})

	it("hasVoted returns false when no cached data exists", async () => {
		const useGovernance = await loadUseGovernance()
		const { result } = renderHook(() => useGovernance(), {
			wrapper: createWrapper("GADDR"),
		})

		expect(result.current.hasVoted(1)).toBe(false)
	})
})
