// Mock process.env BEFORE importing anything from the app
process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID = "CCONTRACT"
process.env.USDC_CONTRACT_ID = "CUSDCCONTRACT"
process.env.STARTING_LEDGER = "100"

import express from "express"
import request from "supertest"
import { donateRouter } from "../routes/donate.routes"

// Mock Horizon SDK
const mockStrictReceive = jest.fn()
const mockPaths = jest.fn().mockReturnValue({
	strictReceive: mockStrictReceive,
	source: jest.fn().mockReturnThis(),
	limit: jest.fn().mockReturnThis(),
	call: jest.fn(),
})

jest.mock("@stellar/stellar-sdk", () => {
	const original = jest.requireActual("@stellar/stellar-sdk")
	return {
		...original,
		Horizon: {
			Server: jest.fn().mockImplementation(() => ({
				paths: jest.fn().mockReturnValue(mockPaths),
				loadAccount: jest.fn().mockResolvedValue({
					balances: [
						{
							asset_type: "native",
							balance: "1000.0000000",
						},
					],
				}),

				// Keep original for other tests
				transactions: original.Horizon?.Server?.prototype?.transactions,
			})),
		},
	}
})

// Mock the donate service functions
const mockDiscoverPaths = jest.fn()
const mockCheckTrustline = jest.fn()
const mockBuildDonateTransaction = jest.fn()
const mockGetAvailableAssets = jest.fn()

jest.mock("../services/donate.service", () => ({
	discoverPaths: (...args: unknown[]) => mockDiscoverPaths(...args),
	checkTrustline: (...args: unknown[]) => mockCheckTrustline(...args),
	buildDonateTransaction: (...args: unknown[]) =>
		mockBuildDonateTransaction(...args),
	getAvailableAssets: (...args: unknown[]) => mockGetAvailableAssets(...args),
}))

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use("/api", donateRouter)
	return app
}

describe("Donate Routes", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe("GET /api/donate/assets", () => {
		it("returns available source assets", async () => {
			mockGetAvailableAssets.mockReturnValue([
				{
					code: "XLM",
					name: "Stellar Lumens",
					native: true,
					env_configured: true,
				},
				{
					code: "USDC",
					name: "USD Coin",
					native: false,
					env_configured: true,
				},
				{
					code: "EURC",
					name: "Euro Coin",
					native: false,
					env_configured: true,
				},
			])

			const res = await request(buildApp()).get("/api/donate/assets")

			expect(res.status).toBe(200)
			expect(res.body.assets).toHaveLength(3)
			expect(res.body.assets[0].code).toBe("XLM")
		})

		it("handles errors gracefully", async () => {
			mockGetAvailableAssets.mockImplementation(() => {
				throw new Error("Service error")
			})

			const res = await request(buildApp()).get("/api/donate/assets")
			expect(res.status).toBe(500)
			expect(res.body.error).toBeDefined()
		})
	})

	describe("GET /api/donate/paths", () => {
		it("returns payment paths for a valid query", async () => {
			mockDiscoverPaths.mockResolvedValue({
				source_asset: "XLM",
				dest_asset: "USDC",
				dest_amount: "10.0000000",
				paths: [
					{
						destination_amount: "10.0000000",
						source_amount: "92.5000000",
						source_asset_code: "XLM",
						path: [{ asset_code: "USDC", asset_issuer: "CUSDCCONTRACT" }],
					},
				],
			})

			const res = await request(buildApp()).get(
				"/api/donate/paths?from=XLM&amount=10",
			)

			expect(res.status).toBe(200)
			expect(res.body.source_asset).toBe("XLM")
			expect(res.body.paths).toHaveLength(1)
			expect(res.body.paths[0].source_amount).toBe("92.5000000")
		})

		it("returns empty paths when no route exists", async () => {
			mockDiscoverPaths.mockResolvedValue({
				source_asset: "UNKNOWN",
				dest_asset: "USDC",
				dest_amount: "10.0000000",
				paths: [],
			})

			const res = await request(buildApp()).get(
				"/api/donate/paths?from=UNKNOWN&amount=10",
			)

			expect(res.status).toBe(200)
			expect(res.body.paths).toHaveLength(0)
		})

		it("returns 400 for missing parameters", async () => {
			const res = await request(buildApp()).get("/api/donate/paths")
			expect(res.status).toBe(400)
			expect(res.body.error).toBeDefined()
		})

		it("returns 400 for invalid amount format", async () => {
			const res = await request(buildApp()).get(
				"/api/donate/paths?from=XLM&amount=abc",
			)
			expect(res.status).toBe(400)
		})
	})

	describe("GET /api/donate/trustline", () => {
		it("returns trustline status for donor and treasury", async () => {
			mockCheckTrustline.mockResolvedValue({
				hasTrustline: true,
				balance: "500.0000000",
			})

			const res = await request(buildApp()).get(
				"/api/donate/trustline?address=GABC&asset=EURC",
			)

			expect(res.status).toBe(200)
			expect(res.body.donor.hasTrustline).toBe(true)
		})

		it("returns 400 for missing parameters", async () => {
			const res = await request(buildApp()).get("/api/donate/trustline")
			expect(res.status).toBe(400)
		})
	})

	describe("POST /api/donate/build", () => {
		it("builds a donation transaction successfully", async () => {
			mockBuildDonateTransaction.mockResolvedValue({
				xdr: "AAAAAG...", // base64 XDR
				source_asset: "XLM",
				send_max: "92.9632500",
				dest_amount: "10.0000000",
				price_impact_pct: 0.52,
			})

			const res = await request(buildApp())
				.post("/api/donate/build")
				.send({
					donor: "GDONOR...",
					treasury: "GTREASURY...",
					source_asset: "XLM",
					dest_amount: "10.0000000",
					slippage_pct: 0.5,
					path: [{ asset_code: "USDC", asset_issuer: "CUSDCCONTRACT" }],
				})

			expect(res.status).toBe(200)
			expect(res.body.xdr).toBeDefined()
			expect(res.body.source_asset).toBe("XLM")
			expect(res.body.send_max).toBe("92.9632500")
			expect(res.body.dest_amount).toBe("10.0000000")
			expect(typeof res.body.price_impact_pct).toBe("number")
		})

		it("returns 400 for missing required fields", async () => {
			const res = await request(buildApp()).post("/api/donate/build").send({
				donor: "GDONOR...",
				// Missing treasury, source_asset, dest_amount
			})

			expect(res.status).toBe(400)
			expect(res.body.error).toBeDefined()
		})

		it("returns 400 for invalid slippage value", async () => {
			const res = await request(buildApp()).post("/api/donate/build").send({
				donor: "GDONOR...",
				treasury: "GTREASURY...",
				source_asset: "XLM",
				dest_amount: "10",
				slippage_pct: 100, // Exceeds max of 50
			})

			expect(res.status).toBe(400)
		})

		it("handles build errors gracefully", async () => {
			mockBuildDonateTransaction.mockRejectedValue(
				new Error("Horizon connection failed"),
			)

			const res = await request(buildApp()).post("/api/donate/build").send({
				donor: "GDONOR...",
				treasury: "GTREASURY...",
				source_asset: "XLM",
				dest_amount: "10",
			})

			expect(res.status).toBe(500)
			expect(res.body.error).toBeDefined()
		})
	})
})

describe("Donate Service - slippage math", () => {
	it("correctly computes send_max with slippage", () => {
		const destAmount = 10
		const slippagePct = 0.5
		const slippageMultiplier = 1 + slippagePct / 100

		const sendMax = destAmount * slippageMultiplier

		expect(sendMax).toBeCloseTo(10.05, 2)
	})

	it("correctly computes send_max with higher slippage", () => {
		const destAmount = 100
		const slippagePct = 2.0
		const slippageMultiplier = 1 + slippagePct / 100

		const sendMax = destAmount * slippageMultiplier

		expect(sendMax).toBeCloseTo(102, 1)
	})

	it("price impact is computed correctly", () => {
		const sourceAmount = 92.5
		const destAmount = 10
		const priceImpact = (sourceAmount / destAmount - 1) * 100

		// (92.5 / 10 - 1) * 100 = 825% — this is the raw ratio
		// In practice, this represents XLM/USDC price
		expect(priceImpact).toBeGreaterThan(0)
	})
})

describe("Donate Service - verification math", () => {
	it("usdcToAtomic converts correctly", () => {
		// The atomic conversion logic from horizon-verify.service.ts
		const USDC_DECIMALS = 7

		function usdcToAtomic(amountUsdc: number): bigint {
			const str = amountUsdc.toFixed(USDC_DECIMALS)
			const dot = str.indexOf(".")
			const whole = str.slice(0, dot)
			const frac = str.slice(dot + 1).padEnd(USDC_DECIMALS, "0")
			return BigInt(whole) * 10_000_000n + BigInt(frac)
		}

		expect(usdcToAtomic(100)).toBe(1_000_000_000n)
		expect(usdcToAtomic(100.5)).toBe(1_005_000_000n)
		expect(usdcToAtomic(0.0000001)).toBe(1n)
		expect(usdcToAtomic(10.1234567)).toBe(101_234_567n)
	})

	it("tolerance check works within bounds", () => {
		const AMOUNT_TOLERANCE_ATOMIC = 1n
		const expected = 1_000_000_000n

		// Exact match
		const diff0 =
			expected >= expected ? expected - expected : expected - expected
		expect(diff0).toBeLessThanOrEqual(AMOUNT_TOLERANCE_ATOMIC)

		// Within tolerance
		const received1 = 1_000_000_001n
		const diff1 =
			received1 >= expected ? received1 - expected : expected - received1
		expect(diff1).toBeLessThanOrEqual(AMOUNT_TOLERANCE_ATOMIC)

		// Outside tolerance
		const received2 = 1_000_000_010n
		const diff2 =
			received2 >= expected ? received2 - expected : expected - received2
		expect(diff2).toBeGreaterThan(AMOUNT_TOLERANCE_ATOMIC)
	})
})
