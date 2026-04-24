import { renderHook, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { useAdminContracts, useTreasuryPauseControl } from "./useAdminContracts"
import * as sorobanAdmin from "../util/sorobanAdmin"
import { useContractIds } from "./useContractIds"
import { useWallet } from "./useWallet"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"

vi.mock("../util/sorobanAdmin", () => ({
	getCourseMilestoneState: vi.fn(),
	getScholarshipTreasuryState: vi.fn(),
	invokeContractMethod: vi.fn(),
}))

vi.mock("./useContractIds", () => ({
	useContractIds: vi.fn(),
}))

vi.mock("./useWallet", () => ({
	useWallet: vi.fn(),
}))

const createWrapper = () => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	})
	return ({ children }: { children: ReactNode }) =>
		createElement(QueryClientProvider, { client: queryClient }, children)
}

describe("useAdminContracts hooks", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("useAdminContracts", () => {
		it("fetches contract states and returns registry", async () => {
			vi.mocked(useContractIds).mockReturnValue({
				learnToken: "LEARN",
				scholarshipTreasury: "TREASURY",
			} as any)

			vi.mocked(sorobanAdmin.getScholarshipTreasuryState).mockResolvedValue({
				isPaused: false,
				owner: "G1",
			} as any)

			const { result } = renderHook(() => useAdminContracts(), {
				wrapper: createWrapper(),
			})

			await waitFor(() => expect(result.current.isSuccess).toBe(true))

			expect(result.current.data?.registry).toContainEqual({
				key: "learnToken",
				name: "Learn Token",
				contractId: "LEARN",
			})
			expect(result.current.data?.scholarshipTreasuryState?.isPaused).toBe(false)
		})
	})

	describe("useTreasuryPauseControl", () => {
		it("calls pause method when pauseTreasury is invoked", async () => {
			vi.mocked(useContractIds).mockReturnValue({
				scholarshipTreasury: "TREASURY",
			} as any)
			vi.mocked(useWallet).mockReturnValue({
				address: "G1",
				signTransaction: vi.fn(),
			} as any)
			vi.mocked(sorobanAdmin.invokeContractMethod).mockResolvedValue({ txHash: "hash" })

			const { result } = renderHook(() => useTreasuryPauseControl(), {
				wrapper: createWrapper(),
			})

			await result.current.pauseTreasury()

			expect(sorobanAdmin.invokeContractMethod).toHaveBeenCalledWith(
				expect.objectContaining({
					contractId: "TREASURY",
					methodName: "pause",
					sourceAddress: "G1",
				}),
			)
		})

		it("throws error if wallet is not connected", async () => {
			vi.mocked(useContractIds).mockReturnValue({
				scholarshipTreasury: "TREASURY",
			} as any)
			vi.mocked(useWallet).mockReturnValue({
				address: undefined,
			} as any)

			const { result } = renderHook(() => useTreasuryPauseControl(), {
				wrapper: createWrapper(),
			})

			await expect(result.current.pauseTreasury()).rejects.toThrow(
				"Connect your wallet",
			)
		})
	})
})
