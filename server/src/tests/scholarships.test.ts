import express from "express"
import request from "supertest"

// Mock the dependencies before importing the router/controller
jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn().mockResolvedValue({ rows: [{ id: 123 }] }),
	},
}))

jest.mock("../services/stellar-contract.service", () => ({
	stellarContractService: {
		submitScholarshipProposal: jest.fn().mockResolvedValue({
			txHash: "fake_tx_hash",
			simulated: true,
		}),
	},
}))

import { scholarshipsRouter } from "../routes/scholarships.routes"

const app = express()
app.use(express.json())
app.use("/api", scholarshipsRouter)

describe("Scholarship Application API", () => {
	it("should accept valid scholarship application", async () => {
		const response = await request(app).post("/api/scholarships/apply").send({
			applicant_address:
				"GBX7B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2",
			full_name: "John Doe",
			course_id: "stellar-101",
			motivation: "I want to learn about Stellar and build on it.",
			evidence_url: "https://example.com/evidence",
		})

		expect(response.status).toBe(201)
		expect(response.body).toHaveProperty("proposal_id", 123)
		expect(response.body).toHaveProperty("tx_hash", "fake_tx_hash")
	})

	it("should reject invalid scholarship application (missing field)", async () => {
		const response = await request(app).post("/api/scholarships/apply").send({
			applicant_address:
				"GBX7B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2",
			full_name: "John Doe",
		})

		expect(response.status).toBe(400)
		expect(response.body).toHaveProperty("error", "Invalid application data")
	})
})
