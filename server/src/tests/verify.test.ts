const poolQueryMock = jest.fn()
jest.mock("../db/index", () => ({ pool: { query: poolQueryMock } }))

const mockGetScholarNftOnChain = jest.fn()
jest.mock("../services/stellar-contract.service", () => ({
	stellarContractService: {
		getScholarNftOnChain: mockGetScholarNftOnChain,
	},
}))

import { createHmac } from "crypto"
import express from "express"
import request from "supertest"
import { getRpcCache } from "../lib/rpc-cache"
import { verifyRouter } from "../routes/verify.routes"

function buildApp() {
	const app = express()
	app.use("/api", verifyRouter)
	return app
}

describe("Credential Verification API", () => {
	const secret = "dev_credential_verification_secret_key"

	beforeEach(async () => {
		jest.clearAllMocks()
		process.env.CREDENTIAL_SECRET = secret
		await getRpcCache().invalidate("")
	})

	describe("GET /api/verify/credentials/:id", () => {
		it("returns invalid payload if credential not in DB", async () => {
			poolQueryMock.mockResolvedValueOnce({ rows: [] })

			const res = await request(buildApp()).get("/api/verify/credentials/999")
			expect(res.status).toBe(200)
			expect(res.body.valid).toBe(false)
			expect(res.body.token_id).toBe(999)
			expect(res.body.signature).toBeDefined()

			const expectedSig = createHmac("sha256", secret)
				.update("999::::false")
				.digest("hex")
			expect(res.body.signature).toBe(expectedSig)
		})

		it("returns valid signed payload if credential exists and is active", async () => {
			// Mock DB scholar_nfts result
			poolQueryMock.mockResolvedValueOnce({
				rows: [
					{
						scholar_address: "Glearner123",
						course_id: "stellar-basics",
						minted_at: "2026-07-16T20:00:00.000Z",
						revoked: false,
					},
				],
			})
			// Mock DB events tx_hash result
			poolQueryMock.mockResolvedValueOnce({
				rows: [{ tx_hash: "0xtxhash123" }],
			})
			// Mock contract helper
			mockGetScholarNftOnChain.mockResolvedValue({
				owner: "Glearner123",
				revoked: false,
				metadataUri: "ipfs://test",
				issuedAt: "2026-07-16T20:00:00.000Z",
			})

			const res = await request(buildApp()).get("/api/verify/credentials/1")
			expect(res.status).toBe(200)
			expect(res.body.valid).toBe(true)
			expect(res.body.learner_address).toBe("Glearner123")
			expect(res.body.course.id).toBe("stellar-basics")
			expect(res.body.tx_hash).toBe("0xtxhash123")

			const expectedSig = createHmac("sha256", secret)
				.update("1:Glearner123:stellar-basics:2026-07-16T20:00:00.000Z:true")
				.digest("hex")
			expect(res.body.signature).toBe(expectedSig)
		})

		it("returns invalid if credential is revoked", async () => {
			poolQueryMock.mockResolvedValueOnce({
				rows: [
					{
						scholar_address: "Glearner123",
						course_id: "stellar-basics",
						minted_at: "2026-07-16T20:00:00.000Z",
						revoked: true,
					},
				],
			})
			poolQueryMock.mockResolvedValueOnce({
				rows: [{ tx_hash: "0xtxhash123" }],
			})
			mockGetScholarNftOnChain.mockResolvedValue({
				owner: "Glearner123",
				revoked: true,
				metadataUri: "ipfs://test",
				issuedAt: "2026-07-16T20:00:00.000Z",
			})

			const res = await request(buildApp()).get("/api/verify/credentials/1")
			expect(res.status).toBe(200)
			expect(res.body.valid).toBe(false)
		})
	})

	describe("GET /api/verify/address/:address", () => {
		it("lists all valid credentials and signs the list", async () => {
			// Mock list of token IDs in DB for address
			poolQueryMock.mockResolvedValueOnce({
				rows: [{ token_id: 1 }, { token_id: 2 }],
			})

			// Mock resolution calls (verify/credentials)
			// Mock DB calls for token 1
			poolQueryMock.mockResolvedValueOnce({
				rows: [
					{
						scholar_address: "Glearner123",
						course_id: "stellar-basics",
						minted_at: "2026-07-16T20:00:00.000Z",
						revoked: false,
					},
				],
			})
			poolQueryMock.mockResolvedValueOnce({
				rows: [{ tx_hash: "0xtxhash1" }],
			})
			mockGetScholarNftOnChain.mockResolvedValueOnce({
				owner: "Glearner123",
				revoked: false,
				metadataUri: "ipfs://test1",
				issuedAt: "2026-07-16T20:00:00.000Z",
			})

			// Mock DB calls for token 2
			poolQueryMock.mockResolvedValueOnce({
				rows: [
					{
						scholar_address: "Glearner123",
						course_id: "soroban-fundamentals",
						minted_at: "2026-07-16T21:00:00.000Z",
						revoked: false,
					},
				],
			})
			poolQueryMock.mockResolvedValueOnce({
				rows: [{ tx_hash: "0xtxhash2" }],
			})
			mockGetScholarNftOnChain.mockResolvedValueOnce({
				owner: "Glearner123",
				revoked: false,
				metadataUri: "ipfs://test2",
				issuedAt: "2026-07-16T21:00:00.000Z",
			})

			const res = await request(buildApp()).get(
				"/api/verify/address/Glearner123",
			)
			expect(res.status).toBe(200)
			expect(res.body.address).toBe("Glearner123")
			expect(res.body.credentials).toHaveLength(2)
			expect(res.body.credentials[0].token_id).toBe(1)
			expect(res.body.credentials[1].token_id).toBe(2)

			const expectedSig = createHmac("sha256", secret)
				.update("Glearner123:1,2")
				.digest("hex")
			expect(res.body.signature).toBe(expectedSig)
		})
	})
})
