// Mock process.env BEFORE importing anything from the app
process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID = "CCONTRACT"
process.env.STARTING_LEDGER = "100"

import express from "express"
import request from "supertest"
import { treasuryRouter } from "../routes/treasury.routes"

// Mock @stellar/stellar-sdk
const mockGetEvents = jest.fn()
const mockSimulateTransaction = jest.fn()
jest.mock("@stellar/stellar-sdk", () => ({
	rpc: {
		Server: jest.fn().mockImplementation(() => ({
			getEvents: mockGetEvents,
			simulateTransaction: mockSimulateTransaction,
		})),
		Api: {
			isSimulationError: jest.fn().mockReturnValue(false),
		},
	},
	scValToNative: (val: any) => val, // Simple mock
	Contract: jest.fn().mockImplementation(() => ({ call: jest.fn() })),
	TransactionBuilder: jest.fn().mockImplementation(() => ({
		addOperation: jest.fn().mockReturnThis(),
		setTimeout: jest.fn().mockReturnThis(),
		build: jest.fn().mockReturnValue({}),
	})),
	Account: jest.fn(),
	Networks: { TESTNET: "testnet", PUBLIC: "public" },
	nativeToScVal: (val: any) => val,
}))

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use("/api", treasuryRouter)
	return app
}

describe("Treasury Routes", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe("GET /api/treasury/stats", () => {
		it("returns aggregated statistics", async () => {
			mockGetEvents.mockResolvedValue({
				events: [
					{
						value: { amount: "1000", donor: "G1" },
						topic: ["deposit"],
					},
					{
						value: { amount: "500", scholar: "S1" },
						topic: ["disburse"],
					},
					{
						value: {},
						topic: ["proposal_submitted"],
					},
				],
			})

			const res = await request(buildApp()).get("/api/treasury/stats")

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				total_deposited_usdc: "1000",
				total_disbursed_usdc: "500",
				scholars_funded: 1,
				active_proposals: 1,
				donors_count: 1,
			})
		})
	})

	describe("GET /api/treasury/activity", () => {
		it("returns paginated activity feed", async () => {
			mockGetEvents.mockResolvedValue({
				events: [
					{
						value: { amount: "1000", donor: "G1" },
						topic: ["deposit"],
						txHash: "hash1",
						ledgerClosedAt: "2026-01-01T00:00:00Z",
					},
					{
						value: { amount: "500", scholar: "S1" },
						topic: ["disburse"],
						txHash: "hash2",
						ledgerClosedAt: "2026-01-02T00:00:00Z",
					},
				],
			})

			const res = await request(buildApp()).get(
				"/api/treasury/activity?limit=1",
			)

			expect(res.status).toBe(200)
			expect(res.body.data).toHaveLength(1)
			// Sorted by date descending, so disburse should be first
			expect(res.body.data[0].type).toBe("disburse")
		})
	})

	describe("GET /api/treasury/allocations", () => {
		it("returns idle/allocated/yield breakdown, venue and event trail", async () => {
			// On-chain read returns a value for every simulated getter.
			mockSimulateTransaction.mockResolvedValue({
				result: { retval: "7500000" },
			})

			mockGetEvents.mockResolvedValue({
				events: [
					{
						value: { strategy: "CSTRAT", amount: "2500000" },
						topic: ["allocated"],
						txHash: "hash1",
						ledgerClosedAt: "2026-01-01T00:00:00Z",
					},
					{
						value: { strategy: "CSTRAT", amount: "1000000", yield_amount: "500000" },
						topic: ["harvested"],
						txHash: "hash2",
						ledgerClosedAt: "2026-01-02T00:00:00Z",
					},
				],
			})

			const res = await request(buildApp()).get("/api/treasury/allocations")

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				idle_usdc: "7500000",
				allocated_usdc: "7500000",
				accrued_yield: "7500000",
				total_yield: "7500000",
				venue: { address: "7500000", name: "LearnVault Lending Market" },
				events: [
					expect.objectContaining({ type: "harvested" }),
					expect.objectContaining({ type: "allocated" }),
				],
				pagination: { limit: 20, total: 2 },
			})
		})

		it("returns 503 when the treasury contract is not configured", async () => {
			const original = process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID
			delete process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID
			const res = await request(buildApp()).get("/api/treasury/allocations")
			expect(res.status).toBe(503)
			process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID = original as string
		})
	})
})
