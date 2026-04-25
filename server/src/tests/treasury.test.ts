// Mock process.env BEFORE importing anything from the app
process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID = "CCONTRACT"
process.env.STARTING_LEDGER = "100"

import express from "express"
import request from "supertest"
import { treasuryRouter } from "../routes/treasury.routes"

// Mock @stellar/stellar-sdk
const mockGetEvents = jest.fn()
jest.mock("@stellar/stellar-sdk", () => ({
	rpc: {
		Server: jest.fn().mockImplementation(() => ({
			getEvents: mockGetEvents,
		})),
	},
	scValToNative: (val: any) => val, // Simple mock
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

			const res = await request(buildApp()).get("/api/treasury/activity?limit=1")

			expect(res.status).toBe(200)
			expect(res.body.events).toHaveLength(1)
			// Sorted by date descending, so disburse should be first
			expect(res.body.events[0].type).toBe("disburse")
		})
	})
})
