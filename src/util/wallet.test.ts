import { describe, it, expect, vi, beforeEach } from "vitest"

// --- Define mocks first ---
const mockCall = vi.fn()
const mockAccountId = vi.fn(() => ({ call: mockCall }))
const mockAccounts = vi.fn(() => ({ accountId: mockAccountId }))

// --- Mock modules ---
vi.mock("@creit.tech/stellar-wallets-kit", () => {
	class MockKit {
		openModal = vi.fn()
		disconnect = vi.fn()
		setWallet = vi.fn()
		getAddress = vi.fn().mockResolvedValue({ address: "" })
		getNetwork = vi
			.fn()
			.mockResolvedValue({ network: "", networkPassphrase: "" })
		signTransaction = vi.fn()
	}
	return {
		StellarWalletsKit: MockKit,
		sep43Modules: vi.fn().mockReturnValue([]),
	}
})

vi.mock("../contracts/util", () => ({
	networkPassphrase: "Test SDF Network ; September 2015",
	stellarNetwork: "TESTNET",
}))

vi.mock("@stellar/stellar-sdk", () => ({
	Horizon: {
		Server: class {
			accounts() {
				return mockAccounts()
			}
		},
	},
}))

import { fetchBalances } from "./wallet"

beforeEach(() => {
	vi.clearAllMocks()
})

describe("fetchBalances", () => {
	it("returns mapped balances keyed by asset", async () => {
		mockCall.mockResolvedValueOnce({
			balances: [
				{ asset_type: "native", balance: "100.5" },
				{
					asset_type: "credit_alphanum4",
					asset_code: "LRN",
					asset_issuer: "GISSUER",
					balance: "250",
				},
			],
		})

		const result = await fetchBalances("GTEST")
		expect(result).toHaveProperty("xlm")
		expect(result).toHaveProperty("LRN:GISSUER")
		expect(mockAccountId).toHaveBeenCalledWith("GTEST")
	})

	it("returns empty object when account is not found", async () => {
		mockCall.mockRejectedValueOnce(new Error("not found"))
		const result = await fetchBalances("GUNFUNDED")
		expect(result).toEqual({})
	})

	it("returns empty object and logs on unexpected errors", async () => {
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
		mockCall.mockRejectedValueOnce(new Error("network timeout"))
		const result = await fetchBalances("GFAIL")
		expect(result).toEqual({})
		expect(consoleSpy).toHaveBeenCalled()
		consoleSpy.mockRestore()
	})

	it("maps liquidity_pool_shares by pool id", async () => {
		mockCall.mockResolvedValueOnce({
			balances: [
				{
					asset_type: "liquidity_pool_shares",
					liquidity_pool_id: "pool123",
					balance: "10",
				},
			],
		})

		const result = await fetchBalances("GTEST")
		expect(result).toHaveProperty("pool123")
	})
})
