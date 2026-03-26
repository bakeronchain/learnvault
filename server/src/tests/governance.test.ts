import express from "express"
import request from "supertest"

// Mock the dependencies before importing the router/controller
jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn().mockResolvedValue({ rows: [{ id: 456 }] }),
	},
}))

jest.mock("../services/stellar-contract.service", () => ({
	stellarContractService: {
		submitScholarshipProposal: jest.fn().mockResolvedValue({
			txHash: "mock_tx_hash_abc123",
			proposalId: null,
			simulated: false,
		}),
	},
}))

import { governanceRouter } from "../routes/governance.routes"

const app = express()
app.use(express.json())
app.use("/api", governanceRouter)

describe("POST /api/governance/proposals", () => {
	it("should create a valid governance proposal", async () => {
		const response = await request(app)
			.post("/api/governance/proposals")
			.send({
				author_address:
					"GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBFUKJQ2K5RQDD",
				title: "Fund my Soroban course",
				description: "I am learning Soroban and need funding for my course.",
				requested_amount: "500",
				evidence_url: "https://example.com/my-proposal",
			})

		expect(response.status).toBe(201)
		expect(response.body).toHaveProperty("proposal_id", 456)
		expect(response.body).toHaveProperty("tx_hash", "mock_tx_hash_abc123")
	})

	it("should reject proposal with missing required fields", async () => {
		const response = await request(app)
			.post("/api/governance/proposals")
			.send({
				author_address:
					"GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBFUKJQ2K5RQDD",
				title: "Fund my course",
			})

		expect(response.status).toBe(400)
		expect(response.body).toHaveProperty("error", "Invalid proposal data")
		expect(response.body).toHaveProperty("details")
	})

	it("should reject proposal with invalid author_address (too short)", async () => {
		const response = await request(app)
			.post("/api/governance/proposals")
			.send({
				author_address: "GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBF",
				title: "Fund my Soroban course",
				description: "I am learning Soroban and need funding for my course.",
				requested_amount: "500",
				evidence_url: "https://example.com/my-proposal",
			})

		expect(response.status).toBe(400)
		expect(response.body).toHaveProperty("error", "Invalid proposal data")
		expect(response.body.details).toHaveProperty("author_address")
	})

	it("should reject proposal with invalid evidence_url", async () => {
		const response = await request(app)
			.post("/api/governance/proposals")
			.send({
				author_address:
					"GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBFUKJQ2K5RQDD",
				title: "Fund my Soroban course",
				description: "I am learning Soroban and need funding for my course.",
				requested_amount: "500",
				evidence_url: "not-a-valid-url",
			})

		expect(response.status).toBe(400)
		expect(response.body).toHaveProperty("error", "Invalid proposal data")
		expect(response.body.details).toHaveProperty("evidence_url")
	})

	it("should reject proposal with invalid requested_amount", async () => {
		const response = await request(app)
			.post("/api/governance/proposals")
			.send({
				author_address:
					"GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBFUKJQ2K5RQDD",
				title: "Fund my Soroban course",
				description: "I am learning Soroban and need funding for my course.",
				requested_amount: "not-a-number",
				evidence_url: "https://example.com/my-proposal",
			})

		expect(response.status).toBe(400)
		expect(response.body).toHaveProperty("error", "Invalid proposal data")
		expect(response.body.details).toHaveProperty("requested_amount")
	})

	it("should handle contract call failure gracefully", async () => {
		const { stellarContractService } = await import(
			"../services/stellar-contract.service"
		)
		;(stellarContractService.submitScholarshipProposal as jest.Mock).mockRejectedValueOnce(
			new Error("Contract call failed"),
		)

		const response = await request(app)
			.post("/api/governance/proposals")
			.send({
				author_address:
					"GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBFUKJQ2K5RQDD",
				title: "Fund my Soroban course",
				description: "I am learning Soroban and need funding for my course.",
				requested_amount: "500",
				evidence_url: "https://example.com/my-proposal",
			})

		expect(response.status).toBe(500)
		expect(response.body).toHaveProperty(
			"error",
			"Failed to create governance proposal",
		)
		expect(response.body).toHaveProperty("message")
	})
})
