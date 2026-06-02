import { describe, it, expect, vi, beforeEach } from "vitest"
import {
	getProfileIdentity,
	updateProfileIdentity,
	loadProfileOnChainData,
} from "./profileData"

// Mock localStorage
const localStorageMock = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn(),
}
Object.defineProperty(window, "localStorage", {
	value: localStorageMock,
})

// Mock contracts/util
vi.mock("../contracts/util", () => ({
	rpcUrl: "http://localhost:8000/rpc",
	horizonUrl: "http://localhost:8000",
	stellarNetwork: "TESTNET",
}))

// Mock @stellar/stellar-sdk
vi.mock("@stellar/stellar-sdk", () => ({
	Horizon: {
		Server: class MockHorizonServer {
			constructor() {
				// Mock constructor
			}
			accounts() {
				return {
					accountId: () => ({
						call: vi.fn().mockResolvedValue({
							balances: [
								{ asset_code: "LRN", balance: "1,000" },
								{ asset_type: "native" },
							],
						}),
					}),
				}
			}
		},
	},
}))

// Mock fetch
global.fetch = vi.fn()

describe("profileData utilities", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("getProfileIdentity", () => {
		it("returns default identity when no data exists", () => {
			localStorageMock.getItem.mockReturnValue(null)

			const result = getProfileIdentity("GDTESTADDRESS")

			expect(result).toEqual({
				bio: "",
				joinDateIso: expect.any(String),
			})
			expect(localStorageMock.getItem).toHaveBeenCalledWith(
				"profileIdentity:GDTESTADDRESS",
			)
		})

		it("returns stored identity when valid data exists", () => {
			const storedData = {
				bio: "Test bio",
				avatarUrl: "https://example.com/avatar.jpg",
				joinDateIso: "2023-01-01T00:00:00.000Z",
			}
			localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData))

			const result = getProfileIdentity("GDTESTADDRESS")

			expect(result).toEqual(storedData)
		})

		it("returns default identity when stored data is corrupted", () => {
			localStorageMock.getItem.mockReturnValue("invalid json")

			const result = getProfileIdentity("GDTESTADDRESS")

			expect(result).toEqual({
				bio: "",
				joinDateIso: expect.any(String),
			})
		})

		it("fills missing fields with defaults", () => {
			const partialData = { bio: "Partial bio" }
			localStorageMock.getItem.mockReturnValue(JSON.stringify(partialData))

			const result = getProfileIdentity("GDTESTADDRESS")

			expect(result).toEqual({
				bio: "Partial bio",
				joinDateIso: expect.any(String),
			})
		})
	})

	describe("updateProfileIdentity", () => {
		it("updates existing profile identity", () => {
			const existingData = {
				bio: "Original bio",
				joinDateIso: "2023-01-01T00:00:00.000Z",
			}
			localStorageMock.getItem.mockReturnValue(JSON.stringify(existingData))

			const result = updateProfileIdentity("GDTESTADDRESS", {
				bio: "Updated bio",
			})

			expect(result).toEqual({
				bio: "Updated bio",
				joinDateIso: "2023-01-01T00:00:00.000Z",
			})
			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				"profileIdentity:GDTESTADDRESS",
				JSON.stringify(result),
			)
		})

		it("creates new profile identity when none exists", () => {
			localStorageMock.getItem.mockReturnValue(null)

			const result = updateProfileIdentity("GDTESTADDRESS", {
				bio: "New bio",
				avatarUrl: "https://example.com/new-avatar.jpg",
			})

			expect(result).toEqual({
				bio: "New bio",
				avatarUrl: "https://example.com/new-avatar.jpg",
				joinDateIso: expect.any(String),
			})
		})
	})

	describe("loadProfileOnChainData", () => {
		beforeEach(() => {
			// Mock environment variables
			vi.stubEnv("PUBLIC_LEARN_TOKEN_CONTRACT", "LEARN_TOKEN_CONTRACT")
			vi.stubEnv(
				"PUBLIC_COURSE_MILESTONE_CONTRACT",
				"COURSE_MILESTONE_CONTRACT",
			)
			vi.stubEnv("PUBLIC_SCHOLAR_NFT_CONTRACT", "SCHOLAR_NFT_CONTRACT")
			vi.stubEnv(
				"PUBLIC_SCHOLARSHIP_GOVERNANCE_CONTRACT",
				"SCHOLARSHIP_GOVERNANCE_CONTRACT",
			)
		})

		it("loads profile data from horizon and events", async () => {
			// Mock successful fetch response
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({
					result: {
						events: [
							{
								id: "event1",
								ledgerCloseTime: "2023-01-01T00:00:00Z",
								topics: ["GDTESTADDRESS"],
								value: { type: "complete" },
							},
							{
								id: "event2",
								ledgerCloseTime: "2023-01-02T00:00:00Z",
								topics: ["GDTESTADDRESS"],
								value: { type: "mint" },
							},
						],
					},
				}),
			} as unknown as Response)

			const result = await loadProfileOnChainData("GDTESTADDRESS")

			// Check that result has the expected structure and values
			expect(result).toHaveProperty("reputationScore", 1000)
			expect(result).toHaveProperty("lrnBalance", 1000)
			expect(result).toHaveProperty("percentile")
			expect(result).toHaveProperty("skillTracks")
			expect(result).toHaveProperty("credentials")
			expect(result).toHaveProperty("scholarships")
			expect(result).toHaveProperty("activity")
		})

		it("handles fetch errors gracefully", async () => {
			// Mock failed fetch response
			vi.mocked(fetch).mockRejectedValue(new Error("Network error"))

			const result = await loadProfileOnChainData("GDTESTADDRESS")

			expect(result).toEqual({
				reputationScore: 1000,
				lrnBalance: 1000,
				percentile: expect.any(Number),
				skillTracks: [],
				credentials: [],
				scholarships: [],
				activity: [],
			})
		})

		// it("handles horizon API errors gracefully", async () => {
		// 	// Mock horizon API error by creating a new mock implementation
		// 	vi.doMock("@stellar/stellar-sdk", () => ({
		// 		Horizon: {
		// 			Server: class MockErrorHorizonServer {
		// 				constructor(url: string, options?: any) {
		// 					// Mock constructor
		// 				}
		// 				accounts() {
		// 					return {
		// 						accountId: () => ({
		// 							call: vi.fn().mockRejectedValue(new Error("Account not found")),
		// 						}),
		// 					}
		// 				}
		// 			},
		// 		},
		// 	}))

		// 	// Re-import the module to get the new mock
		// 	const { loadProfileOnChainData: loadProfileOnChainDataWithError } = await import("./profileData")

		// 	await expect(loadProfileOnChainDataWithError("GDTESTADDRESS")).rejects.toThrow(
		// 		"Account not found",
		// 	)
		// })
	})
})
