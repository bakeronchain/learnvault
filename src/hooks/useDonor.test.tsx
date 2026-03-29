import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockShowError = vi.fn()

vi.mock("../contracts/util", () => ({ rpcUrl: "http://localhost:8000/rpc" }))
vi.mock("../providers/WalletProvider", () => ({
	WalletContext: {
		Provider: ({ children }: { children: unknown }) => children,
	},
}))
vi.mock("./useWallet", () => ({ useWallet: vi.fn() }))
vi.mock("./useContractIds", () => ({ useContractIds: vi.fn() }))
vi.mock("../components/Toast/ToastProvider", () => ({
	useToast: () => ({ showError: mockShowError }),
}))

import { useContractIds } from "./useContractIds"
import { useDonor } from "./useDonor"
import { useWallet } from "./useWallet"

const mockUseWallet = vi.mocked(useWallet)
const mockUseContractIds = vi.mocked(useContractIds)
const mockFetch = vi.fn()
global.fetch = mockFetch

const baseWallet = {
	address: "GDONOR123" as string | undefined,
	balances: {},
	isPending: false,
	isReconnecting: false,
	signTransaction: vi.fn(),
	updateBalances: vi.fn(),
}

const baseContracts = {
	scholarshipTreasury: "CTREASURY" as string | undefined,
	governanceToken: "CGOVTOKEN" as string | undefined,
	learnToken: undefined as string | undefined,
	scholarNft: undefined as string | undefined,
	courseMilestone: undefined as string | undefined,
	milestoneEscrow: undefined as string | undefined,
	usdc: undefined as string | undefined,
	isDeployed: (id: string | undefined): id is string => Boolean(id),
}

beforeEach(() => {
	vi.clearAllMocks()
	mockUseWallet.mockReturnValue(baseWallet as ReturnType<typeof useWallet>)
	mockUseContractIds.mockReturnValue(
		baseContracts as ReturnType<typeof useContractIds>,
	)
	mockFetch.mockResolvedValue({
		ok: true,
		json: async () => ({ result: { events: [] } }),
	})
})

describe("useDonor", () => {
	it("returns empty data when no contract IDs are configured", async () => {
		mockUseContractIds.mockReturnValue({
			...baseContracts,
			scholarshipTreasury: undefined,
			governanceToken: undefined,
			isDeployed: (_id: string | undefined): _id is string => false,
		} as ReturnType<typeof useContractIds>)

		const { result } = renderHook(() => useDonor())

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.contributions).toHaveLength(0)
		expect(result.current.stats.totalContributed).toBe(0)
		expect(result.current.isEmpty).toBe(true)
	})

	it("parses deposit events into contribution stats", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				result: {
					events: [
						{
							txHash: "0xabc",
							ledger: 100,
							ledgerCloseTime: "2024-01-15T10:00:00Z",
							topics: ["deposit"],
							value: { amount: "5000000", address: "gdonor123" },
						},
					],
				},
			}),
		})

		const { result } = renderHook(() => useDonor())

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.contributions.length).toBeGreaterThan(0)
		expect(result.current.stats.totalContributed).toBeGreaterThan(0)
	})

	it("handles fetch errors gracefully", async () => {
		mockFetch.mockRejectedValue(new Error("Network error"))

		const { result } = renderHook(() => useDonor())

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.error).toBe("Failed to load donor data")
		expect(result.current.contributions).toHaveLength(0)
	})

	it("returns empty data when wallet is not connected", async () => {
		mockUseWallet.mockReturnValue({
			...baseWallet,
			address: undefined,
		} as ReturnType<typeof useWallet>)

		const { result } = renderHook(() => useDonor())

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.isEmpty).toBe(true)
		expect(result.current.error).toBeNull()
	})
})
