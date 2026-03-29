process.env.JWT_SECRET = "learnvault-secret"
process.env.ADMIN_ADDRESSES = "GADMIN123"

import express from "express"
import jwt from "jsonwebtoken"
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
		getGovernanceTokenBalance: jest.fn().mockResolvedValue("1250000000"),
		castVote: jest.fn().mockResolvedValue({
			txHash: "mock_vote_tx_hash",
			simulated: false,
		}),
		cancelProposal: jest.fn().mockResolvedValue({
			txHash: "mock_cancel_tx_hash",
			simulated: false,
		}),
	},
}))

import { governanceRouter } from "../routes/governance.routes"

const app = express()
app.use(express.json())
app.use("/api", governanceRouter)

const JWT_SECRET = "learnvault-secret"

function makeToken(address: string) {
	return jwt.sign({ address }, JWT_SECRET, { expiresIn: "1h" })
}

describe("POST /api/governance/proposals", () => {
	it("should create a valid governance proposal", async () => {
		const response = await request(app).post("/api/governance/proposals").send({
			author_address:
				"GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBFUKJQ2K5RQDDXYZ",
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
		const response = await request(app).post("/api/governance/proposals").send({
			author_address:
				"GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBFUKJQ2K5RQDDXYZ",
			title: "Fund my course",
		})

		expect(response.status).toBe(400)
		expect(response.body).toHaveProperty("error", "Invalid proposal data")
		expect(response.body).toHaveProperty("details")
	})

	it("should reject proposal with invalid author_address (too short)", async () => {
		const response = await request(app).post("/api/governance/proposals").send({
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
		const response = await request(app).post("/api/governance/proposals").send({
			author_address:
				"GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBFUKJQ2K5RQDDXYZ",
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
		const response = await request(app).post("/api/governance/proposals").send({
			author_address:
				"GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBFUKJQ2K5RQDDXYZ",
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
		const { stellarContractService } =
			await import("../services/stellar-contract.service")
		;(
			stellarContractService.submitScholarshipProposal as jest.Mock
		).mockRejectedValueOnce(new Error("Contract call failed"))

		const response = await request(app).post("/api/governance/proposals").send({
			author_address:
				"GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBFUKJQ2K5RQDDXYZ",
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

describe("GET /api/governance/voting-power/:address", () => {
	it("returns voting power for a valid address", async () => {
		const response = await request(app).get(
			"/api/governance/voting-power/GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBFUKJQ2K5RQDDXYZ",
		)

		expect(response.status).toBe(200)
		expect(response.body.address).toBe(
			"GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBFUKJQ2K5RQDDXYZ",
		)
		expect(response.body.gov_balance).toBe("1250000000")
		expect(response.body.formatted).toBe("125.00")
		expect(response.body.can_vote).toBe(true)
	})

	it("returns can_vote false for zero balance", async () => {
		const { stellarContractService } =
			await import("../services/stellar-contract.service")
		;(
			stellarContractService.getGovernanceTokenBalance as jest.Mock
		).mockResolvedValueOnce("0")

		const response = await request(app).get(
			"/api/governance/voting-power/GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBFUKJQ2K5RQDDXYZ",
		)

		expect(response.status).toBe(200)
		expect(response.body.gov_balance).toBe("0")
		expect(response.body.formatted).toBe("0.00")
		expect(response.body.can_vote).toBe(false)
	})

	it("returns 400 for invalid address", async () => {
		const response = await request(app).get(
			"/api/governance/voting-power/short",
		)

		expect(response.status).toBe(400)
		expect(response.body.error).toBe("Invalid Stellar address")
	})
})

describe("GET /api/proposals", () => {
	it("returns proposals from the alias endpoint", async () => {
		const db = require("../db/index")
		db.pool.query
			.mockResolvedValueOnce({ rows: [{ total: 1 }] })
			.mockResolvedValueOnce({
				rows: [
					{
						id: 7,
						author_address:
							"GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBFUKJQ2K5RQDDXYZ",
						title: "Fund cohort",
						description: "Detailed proposal",
						amount: "500",
						votes_for: "10",
						votes_against: "2",
						status: "pending",
						deadline: "2026-04-10T12:00:00.000Z",
						created_at: "2026-03-28T12:00:00.000Z",
						user_vote_support: true,
					},
				],
			})

		const response = await request(app).get(
			`/api/proposals?viewer_address=${TEST_VOTER}`,
		)

		expect(response.status).toBe(200)
		expect(response.body.total).toBe(1)
		expect(response.body.proposals[0]).toHaveProperty("id", 7)
		expect(response.body.proposals[0]).toHaveProperty("user_vote_support", true)
	})
})

describe("GET /api/proposals/:id", () => {
	it("returns proposal detail from the alias endpoint", async () => {
		const db = require("../db/index")
		db.pool.query.mockResolvedValueOnce({
			rows: [
				{
					id: 9,
					author_address:
						"GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBFUKJQ2K5RQDDXYZ",
					title: "Fund educators",
					description: "Long-form detail",
					amount: "750",
					votes_for: "11",
					votes_against: "4",
					status: "pending",
					deadline: "2026-04-15T12:00:00.000Z",
					created_at: "2026-03-28T12:00:00.000Z",
					user_vote_support: null,
				},
			],
		})

		const response = await request(app).get("/api/proposals/9")

		expect(response.status).toBe(200)
		expect(response.body).toHaveProperty("id", 9)
		expect(response.body).toHaveProperty("title", "Fund educators")
	})
})

// Valid 56-char Stellar test address
const TEST_VOTER = "GDGQVOKHW4VEJRU2TETD6DBRKEO5ERCNF353LW5JBFUKJQ2K5RQDDXYZ"

describe("POST /api/governance/vote", () => {
	let pool: any
	let stellarContractService: any

	beforeEach(() => {
		jest.clearAllMocks()
		const db = require("../db/index")
		const scs = require("../services/stellar-contract.service")
		pool = db.pool
		stellarContractService = scs.stellarContractService
		// Default happy path mocks
		pool.query
			.mockResolvedValueOnce({
				rows: [
					{
						id: 1,
						status: "pending",
						deadline: "2099-01-01T00:00:00.000Z",
						cancelled: false,
					},
				],
			}) // proposal check
			.mockResolvedValueOnce({ rows: [] }) // no existing vote
			.mockResolvedValueOnce({ rows: [{ id: 1 }] }) // insert vote
			.mockResolvedValueOnce({ rows: [] }) // update proposal
			.mockResolvedValueOnce({
				rows: [{ votes_for: "1250000000", votes_against: "0" }],
			}) // fetch updated counts
		stellarContractService.getGovernanceTokenBalance.mockResolvedValue(
			"1250000000",
		)
		stellarContractService.castVote.mockResolvedValue({
			txHash: "mock_vote_tx",
			simulated: false,
		})
	})

	it("should cast a valid vote", async () => {
		const response = await request(app).post("/api/governance/vote").send({
			proposal_id: 1,
			voter_address: TEST_VOTER,
			support: true,
		})

		expect(response.status).toBe(201)
		expect(response.body).toHaveProperty("tx_hash", "mock_vote_tx")
		expect(response.body).toHaveProperty("votes_for")
		expect(response.body).toHaveProperty("votes_against")
	})

	it("should reject vote with invalid proposal_id", async () => {
		const response = await request(app).post("/api/governance/vote").send({
			proposal_id: -1,
			voter_address: TEST_VOTER,
			support: true,
		})

		expect(response.status).toBe(400)
		expect(response.body).toHaveProperty("error", "Invalid vote data")
	})

	it("should reject vote with invalid voter_address", async () => {
		const response = await request(app).post("/api/governance/vote").send({
			proposal_id: 1,
			voter_address: "short",
			support: true,
		})

		expect(response.status).toBe(400)
		expect(response.body).toHaveProperty("error", "Invalid vote data")
	})

	it("should reject vote when proposal not found", async () => {
		pool.query.mockReset()
		pool.query.mockResolvedValueOnce({ rows: [] })

		const response = await request(app).post("/api/governance/vote").send({
			proposal_id: 999,
			voter_address: TEST_VOTER,
			support: true,
		})

		expect(response.status).toBe(404)
		expect(response.body).toHaveProperty("error", "Proposal not found")
	})

	it("should reject vote when proposal is not pending", async () => {
		pool.query.mockReset()
		pool.query.mockResolvedValueOnce({
			rows: [{ id: 1, status: "approved", deadline: null }],
		})

		const response = await request(app).post("/api/governance/vote").send({
			proposal_id: 1,
			voter_address: TEST_VOTER,
			support: true,
		})

		expect(response.status).toBe(400)
		expect(response.body).toHaveProperty(
			"error",
			"Voting is closed for this proposal",
		)
	})

	it("should reject vote when voter already voted", async () => {
		pool.query.mockReset()
		pool.query
			.mockResolvedValueOnce({
				rows: [
					{
						id: 1,
						status: "pending",
						deadline: "2099-01-01T00:00:00.000Z",
						cancelled: false,
					},
				],
			})
			.mockResolvedValueOnce({ rows: [{ id: 1 }] })

		const response = await request(app).post("/api/governance/vote").send({
			proposal_id: 1,
			voter_address: TEST_VOTER,
			support: true,
		})

		expect(response.status).toBe(409)
		expect(response.body).toHaveProperty(
			"error",
			"You have already voted on this proposal",
		)
	})

	it("should reject vote when voter has no GOV tokens", async () => {
		pool.query.mockReset()
		pool.query
			.mockResolvedValueOnce({
				rows: [
					{
						id: 1,
						status: "pending",
						deadline: "2099-01-01T00:00:00.000Z",
						cancelled: false,
					},
				],
			})
			.mockResolvedValueOnce({ rows: [] })
		stellarContractService.getGovernanceTokenBalance.mockResolvedValueOnce("0")

		const response = await request(app).post("/api/governance/vote").send({
			proposal_id: 1,
			voter_address: TEST_VOTER,
			support: true,
		})

		expect(response.status).toBe(400)
		expect(response.body).toHaveProperty("error", "You have no voting power")
	})

	it("should handle contract call failure gracefully", async () => {
		pool.query.mockReset()
		pool.query
			.mockResolvedValueOnce({
				rows: [
					{
						id: 1,
						status: "pending",
						deadline: "2099-01-01T00:00:00.000Z",
						cancelled: false,
					},
				],
			})
			.mockResolvedValueOnce({ rows: [] })
		stellarContractService.castVote.mockRejectedValueOnce(
			new Error("Contract call failed"),
		)

		const response = await request(app).post("/api/governance/vote").send({
			proposal_id: 1,
			voter_address: TEST_VOTER,
			support: true,
		})

		expect(response.status).toBe(500)
		expect(response.body).toHaveProperty("error", "Failed to cast vote")
	})

	it("should reject vote when deadline has passed", async () => {
		pool.query.mockReset()
		pool.query.mockResolvedValueOnce({
			rows: [
				{ id: 1, status: "pending", deadline: "2020-01-01T00:00:00.000Z" },
			],
		})

		const response = await request(app).post("/api/governance/vote").send({
			proposal_id: 1,
			voter_address: TEST_VOTER,
			support: true,
		})

		expect(response.status).toBe(400)
		expect(response.body).toHaveProperty(
			"error",
			"Voting is closed for this proposal",
		)
	})
})

describe("GET /api/proposals/:id/status", () => {
	let pool: any

	beforeEach(() => {
		jest.clearAllMocks()
		pool = require("../db/index").pool
	})

	it("returns open status for a live pending proposal", async () => {
		pool.query.mockResolvedValueOnce({
			rows: [{ id: 7, status: "pending", cancelled: false, deadline: null }],
		})

		const response = await request(app).get("/api/proposals/7/status")

		expect(response.status).toBe(200)
		expect(response.body).toEqual({
			id: 7,
			state: "open",
			status: "pending",
			cancelled: false,
			deadline: null,
		})
	})

	it("returns cancelled state for a cancelled proposal", async () => {
		pool.query.mockResolvedValueOnce({
			rows: [{ id: 7, status: "pending", cancelled: true, deadline: null }],
		})

		const response = await request(app).get("/api/proposals/7/status")

		expect(response.status).toBe(200)
		expect(response.body.state).toBe("cancelled")
	})
})

describe("DELETE /api/proposals/:id", () => {
	let pool: any
	let stellarContractService: any

	beforeEach(() => {
		jest.clearAllMocks()
		const db = require("../db/index")
		const scs = require("../services/stellar-contract.service")
		pool = db.pool
		stellarContractService = scs.stellarContractService
	})

	it("allows an admin to cancel an open proposal", async () => {
		pool.query
			.mockResolvedValueOnce({
				rows: [{ id: 12, status: "pending", cancelled: false, deadline: null }],
			})
			.mockResolvedValueOnce({ rows: [] })

		const response = await request(app)
			.delete("/api/proposals/12")
			.set("Authorization", `Bearer ${makeToken("GADMIN123")}`)

		expect(response.status).toBe(204)
		expect(stellarContractService.cancelProposal).toHaveBeenCalledWith({
			proposalId: 12,
		})
		expect(pool.query).toHaveBeenNthCalledWith(
			2,
			"UPDATE proposals SET cancelled = TRUE WHERE id = $1",
			[12],
		)
	})

	it("rejects non-admin users", async () => {
		const response = await request(app)
			.delete("/api/proposals/12")
			.set("Authorization", `Bearer ${makeToken("GNOTADMIN123")}`)

		expect(response.status).toBe(403)
		expect(response.body.error).toBe("Forbidden: not an admin address")
	})

	it("returns 409 for an already-cancelled proposal", async () => {
		pool.query.mockResolvedValueOnce({
			rows: [{ id: 12, status: "pending", cancelled: true, deadline: null }],
		})

		const response = await request(app)
			.delete("/api/proposals/12")
			.set("Authorization", `Bearer ${makeToken("GADMIN123")}`)

		expect(response.status).toBe(409)
		expect(response.body.error).toBe("Proposal is already cancelled")
		expect(stellarContractService.cancelProposal).not.toHaveBeenCalled()
	})
})
