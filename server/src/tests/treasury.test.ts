// Treasury test suite
process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID = "CCONTRACT"
process.env.STARTING_LEDGER = "100"
process.env.USDC_CONTRACT_ID = "CUSDC"
process.env.GOVERNANCE_TOKEN_CONTRACT_ID = "CGOV"

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
	scValToNative: (val: unknown) => val,
	StrKey: {
		isValidEd25519PublicKey: (val: string) =>
			val.startsWith("G") && val.length === 56,
	},
	xdr: {},
	Address: class {},
}))

// Mock horizon-verify service
const mockVerifyDepositTx = jest.fn()
jest.mock("../services/horizon-verify.service", () => ({
	verifyDepositTx: mockVerifyDepositTx,
}))

// Mock stellar-contract service
const mockGetGovernanceTokenBalance = jest.fn()
jest.mock("../services/stellar-contract.service", () => ({
	stellarContractService: {
		getGovernanceTokenBalance: mockGetGovernanceTokenBalance,
	},
}))

// Mock DB pool
const mockPoolQuery = jest.fn()
jest.mock("../db/index", () => ({
	pool: {
		query: mockPoolQuery,
	},
}))

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use("/api", treasuryRouter)
	return app
}

describe("Treasury Routes", () => {
	beforeEach(() => {
		mockGetEvents.mockClear()
		mockVerifyDepositTx.mockClear()
		mockPoolQuery.mockClear()
		mockGetGovernanceTokenBalance.mockClear()
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
			expect(res.body).toMatchObject({
				total_deposited_usdc: "1000",
				total_disbursed_usdc: "500",
				scholars_funded: 1,
				active_proposals: 1,
				donors_count: 1,
			})
			expect(res.body.asset_balances).toBeDefined()
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
	describe("POST /api/treasury/deposit", () => {
		it("rejects invalid donor_address", async () => {
			const res = await request(buildApp())
				.post("/api/treasury/deposit")
				.send({
					donor_address: "invalid",
					amount: 100,
					tx_hash: "a".repeat(64),
				})

			expect(res.status).toBe(422)
			expect(res.body.error).toBeDefined()
		})

		it("rejects invalid tx_hash (not 64 hex chars)", async () => {
			const res = await request(buildApp()).post("/api/treasury/deposit").send({
				donor_address: "GABC123456789012345678901234567890123456789012345678",
				amount: 100,
				tx_hash: "tooshort",
			})

			expect(res.status).toBe(422)
			expect(res.body.error).toBeDefined()
		})

		it("rejects negative amount", async () => {
			const res = await request(buildApp())
				.post("/api/treasury/deposit")
				.send({
					donor_address: "GABC123456789012345678901234567890123456789012345678",
					amount: -50,
					tx_hash: "a".repeat(64),
				})

			expect(res.status).toBe(422)
			expect(res.body.error).toBeDefined()
		})

		it("returns 409 when tx_hash already exists in DB", async () => {
			mockVerifyDepositTx.mockResolvedValue(true)
			mockPoolQuery.mockResolvedValueOnce({
				rows: [{ id: 1 }],
				rowCount: 1,
			})

			const res = await request(buildApp())
				.post("/api/treasury/deposit")
				.send({
					donor_address: "GABC123456789012345678901234567890123456789012345678",
					amount: 100,
					tx_hash: "a".repeat(64),
				})

			expect(res.status).toBe(409)
			expect(res.body.error.code).toBe("DUPLICATE_DEPOSIT")
		})

		it("returns 400 when on-chain verification fails", async () => {
			mockVerifyDepositTx.mockResolvedValue(false)
			mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })

			const res = await request(buildApp())
				.post("/api/treasury/deposit")
				.send({
					donor_address: "GABC123456789012345678901234567890123456789012345678",
					amount: 100.5,
					tx_hash: "b".repeat(64),
				})

			expect(res.status).toBe(400)
			expect(res.body.error.code).toBe("VERIFICATION_FAILED")
		})

		it("creates deposit record and returns with GOV balance", async () => {
			mockVerifyDepositTx.mockResolvedValue(true)
			mockPoolQuery
				.mockResolvedValueOnce({ rows: [], rowCount: 0 })
				.mockResolvedValueOnce({
					rows: [
						{
							id: 1,
							donor_address:
								"GABC123456789012345678901234567890123456789012345678",
							amount_usdc: "100.5000000",
							gov_issued: "10050.0000000",
							tx_hash: "c".repeat(64),
							created_at: new Date("2026-08-20T10:00:00Z"),
						},
					],
					rowCount: 1,
				})
			mockGetGovernanceTokenBalance.mockResolvedValue("125000000000")

			const res = await request(buildApp())
				.post("/api/treasury/deposit")
				.send({
					donor_address: "GABC123456789012345678901234567890123456789012345678",
					amount: 100.5,
					tx_hash: "c".repeat(64),
				})

			expect(res.status).toBe(201)
			expect(res.body.deposit.id).toBe(1)
			expect(res.body.deposit.gov_issued).toBe("10050.0000000")
			expect(res.body.gov_balance).toBe("125000000000")
			expect(mockVerifyDepositTx).toHaveBeenCalledWith(
				"c".repeat(64),
				100.5,
				"GABC123456789012345678901234567890123456789012345678",
			)
		})

		it("rejects amount with >7 decimals", async () => {
			const res = await request(buildApp())
				.post("/api/treasury/deposit")
				.send({
					donor_address: "GABC123456789012345678901234567890123456789012345678",
					amount: 100.12345678,
					tx_hash: "d".repeat(64),
				})

			expect(res.status).toBe(422)
			expect(res.body.error.message).toContain("decimal places")
		})

		it("handles UNIQUE constraint race with 409", async () => {
			mockVerifyDepositTx.mockResolvedValue(true)
			mockPoolQuery
				.mockResolvedValueOnce({ rows: [], rowCount: 0 })
				.mockRejectedValueOnce({ code: "23505", message: "duplicate key" })

			const res = await request(buildApp())
				.post("/api/treasury/deposit")
				.send({
					donor_address: "GABC123456789012345678901234567890123456789012345678",
					amount: 100,
					tx_hash: "e".repeat(64),
				})

			expect(res.status).toBe(409)
			expect(res.body.error.code).toBe("DUPLICATE_DEPOSIT")
		})

		it("calculates GOV issued exactly with decimal precision", async () => {
			mockVerifyDepositTx.mockResolvedValue(true)
			mockPoolQuery
				.mockResolvedValueOnce({ rows: [], rowCount: 0 })
				.mockResolvedValueOnce({
					rows: [
						{
							id: 2,
							donor_address:
								"GABC123456789012345678901234567890123456789012345678",
							amount_usdc: "0.0000001",
							gov_issued: "0.0000100",
							tx_hash: "f".repeat(64),
							created_at: new Date("2026-08-20T10:00:00Z"),
						},
					],
					rowCount: 1,
				})
			mockGetGovernanceTokenBalance.mockResolvedValue("125000000000")

			const res = await request(buildApp())
				.post("/api/treasury/deposit")
				.send({
					donor_address: "GABC123456789012345678901234567890123456789012345678",
					amount: 0.0000001,
					tx_hash: "f".repeat(64),
				})

			expect(res.status).toBe(201)
			expect(res.body.deposit.amount_usdc).toBe("0.0000001")
			expect(res.body.deposit.gov_issued).toBe("0.0000100")
		})
	})

	describe("GET /api/treasury/deposits/:address", () => {
		it("returns paginated deposits for an address", async () => {
			mockPoolQuery.mockResolvedValue({
				rows: [
					{
						id: 1,
						donor_address:
							"GABC123456789012345678901234567890123456789012345678",
						amount_usdc: "100.0000000",
						gov_issued: "10000.0000000",
						tx_hash: "a".repeat(64),
						created_at: new Date("2026-08-20T10:00:00Z"),
					},
					{
						id: 2,
						donor_address:
							"GABC123456789012345678901234567890123456789012345678",
						amount_usdc: "50.5000000",
						gov_issued: "5050.0000000",
						tx_hash: "b".repeat(64),
						created_at: new Date("2026-08-19T10:00:00Z"),
					},
				],
				rowCount: 2,
			})

			const res = await request(buildApp()).get(
				"/api/treasury/deposits/GABC123456789012345678901234567890123456789012345678?limit=10&page=1",
			)

			expect(res.status).toBe(200)
			expect(res.body.data).toHaveLength(2)
			expect(res.body.data[0].amount_usdc).toBe("100.0000000")
			expect(res.body.pagination.total).toBe(2)
		})

		it("returns empty array when no deposits found", async () => {
			mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 })

			const res = await request(buildApp()).get(
				"/api/treasury/deposits/GDEF123456789012345678901234567890123456789012345678",
			)

			expect(res.status).toBe(200)
			expect(res.body.data).toEqual([])
			expect(res.body.pagination.total).toBe(0)
		})
	})
})
