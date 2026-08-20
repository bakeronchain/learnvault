import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import { type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useToast } from "../components/Toast/ToastProvider"
import { depositToTreasury } from "../services/sponsor-api"
import { createScholarshipTreasuryContract } from "../util/scholarshipTreasury"
import { useContractIds } from "./useContractIds"
import { useSponsorDeposit } from "./useSponsorDeposit"
import { useWallet } from "./useWallet"

vi.mock("./useWallet")
vi.mock("./useContractIds")
vi.mock("../components/Toast/ToastProvider")
vi.mock("../services/sponsor-api")
vi.mock("../util/scholarshipTreasury")

describe("useSponsorDeposit #1017", () => {
	const address = "G".padEnd(56, "A")
	const txHash = "a".repeat(64)
	const signTransaction = vi.fn()
	const updateBalances = vi.fn()
	const contractDeposit = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(useWallet).mockReturnValue({
			address,
			signTransaction,
			updateBalances,
		} as never)
		vi.mocked(useContractIds).mockReturnValue({
			scholarshipTreasury: "C".padEnd(56, "T"),
			usdc: "C".padEnd(56, "U"),
		} as never)
		vi.mocked(useToast).mockReturnValue({
			showInfo: vi.fn(),
			showSuccess: vi.fn(),
			showError: vi.fn(),
		} as never)
		vi.mocked(createScholarshipTreasuryContract).mockReturnValue({
			deposit: contractDeposit,
		} as never)
		contractDeposit.mockResolvedValue(txHash)
		vi.mocked(depositToTreasury).mockResolvedValue({
			deposit: {} as never,
			gov_balance: "10000000",
		})
	})

	const renderDeposit = () => {
		const client = new QueryClient({
			defaultOptions: { mutations: { retry: false } },
		})
		const wrapper = ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		)
		return renderHook(() => useSponsorDeposit(), { wrapper })
	}

	it("deposita on-chain, registra auditoría y actualiza balances", async () => {
		const { result } = renderDeposit()

		await expect(result.current.deposit("100")).resolves.toBe(txHash)

		expect(contractDeposit).toHaveBeenCalledWith(
			"100",
			"C".padEnd(56, "U"),
			signTransaction,
		)
		expect(depositToTreasury).toHaveBeenCalledWith({
			donorAddress: address,
			amount: 100,
			txHash,
		})
		expect(updateBalances).toHaveBeenCalled()
	})

	it("conserva el hash confirmado cuando falla solo la auditoría", async () => {
		vi.mocked(depositToTreasury).mockRejectedValue(new Error("DB unavailable"))
		const { result } = renderDeposit()

		await expect(result.current.deposit("100")).rejects.toThrow(txHash)
		expect(contractDeposit).toHaveBeenCalledTimes(1)
		expect(updateBalances).not.toHaveBeenCalled()
	})
})
