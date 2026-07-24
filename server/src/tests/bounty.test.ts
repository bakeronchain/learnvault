import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"

// ---------------------------------------------------------------------------
// Mocks — must be before imports
// ---------------------------------------------------------------------------
const mockQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 })
const mockRelease = jest.fn()
const mockClientQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 })
const mockConnect = jest.fn().mockResolvedValue({
	query: mockClientQuery,
	release: mockRelease,
})

jest.mock("../db/index", () => ({
	pool: {
		query: mockQuery,
		connect: mockConnect,
	},
}))

jest.mock("../services/stellar-contract.service", () => ({
	stellarContractService: {},
}))

import { createBountyRouter } from "../routes/bounty.routes"
import { isValidTransition } from "../services/bounty.service"

const JWT_SECRET = "test-secret-key-for-bounty-tests"

function makeToken(address: string): string {
	return jwt.sign({ sub: address }, JWT_SECRET, { expiresIn: "1h" })
}

function buildApp() {
	const app = express()
	app.use(express.json())
	const jwtService = {
		verifyWalletToken: jest.fn().mockImplementation(async (token: string) => {
			const decoded = jwt.verify(token, JWT_SECRET) as { sub: string }
			return { sub: decoded.sub }
		}),
		createWalletToken: jest.fn(),
		createRefreshToken: jest.fn(),
		revokeRefreshToken: jest.fn(),
		isRefreshTokenRevoked: jest.fn(),
	}
	app.use("/api", createBountyRouter(jwtService as any))
	return { app, jwtService }
}

const SPONSOR = "GASPONSOR11111111111111111111111111111111111111111111111"
const LEARNER = "GLEARNER2222222222222222222222222222222222222222222222"
const LEARNER2 = "GLEARNER3333333333333333333333333333333333333333333333"

describe("Bounty API", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		mockQuery.mockReset()
		mockClientQuery.mockReset()
		mockConnect.mockReset()
		// Re-establish defaults
		mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })
		mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0 })
		mockConnect.mockResolvedValue({
			query: mockClientQuery,
			release: mockRelease,
		})
	})

	describe("GET /api/bounties", () => {
		it("returns paginated bounties", async () => {
			const { app } = buildApp()
			const bountyRow = {
				id: 1,
				sponsor_addr: SPONSOR,
				title: "Build component",
				description: "A detailed task",
				skill_tags: ["typescript"],
				reward_usdc: "250",
				escrow_tx: "tx123",
				status: "open",
				claimed_by: null,
				deadline: null,
				payout_tx: null,
				reward_tx: null,
				approved_at: null,
				paid_at: null,
				created_at: new Date().toISOString(),
			}
			// First query: COUNT (SQL alias is "total")
			mockQuery.mockResolvedValueOnce({ rows: [{ total: "1" }], rowCount: 1 })
			// Second query: SELECT data
			mockQuery.mockResolvedValueOnce({ rows: [bountyRow], rowCount: 1 })

			const res = await request(app).get("/api/bounties")
			expect(res.status).toBe(200)
			expect(res.body.data).toHaveLength(1)
			expect(res.body.pagination.total).toBe(1)
		})

		it("filters by status", async () => {
			const { app } = buildApp()
			mockQuery
				.mockResolvedValueOnce({ rows: [{ total: "0" }], rowCount: 1 })
				.mockResolvedValueOnce({ rows: [], rowCount: 0 })

			const res = await request(app).get("/api/bounties?status=open")
			expect(res.status).toBe(200)
		})

		it("rejects invalid status", async () => {
			const { app } = buildApp()
			const res = await request(app).get("/api/bounties?status=invalid")
			expect(res.status).toBe(400)
			expect(res.body.error).toContain("Invalid status")
		})
	})

	describe("GET /api/bounties/:id", () => {
		it("returns bounty details", async () => {
			const { app } = buildApp()
			const bounty = {
				id: 1,
				sponsor_addr: SPONSOR,
				title: "Test",
				description: "Desc",
				skill_tags: ["rust"],
				reward_usdc: "100",
				escrow_tx: "tx1",
				status: "open",
				claimed_by: null,
				deadline: null,
				payout_tx: null,
				reward_tx: null,
				approved_at: null,
				paid_at: null,
				created_at: new Date().toISOString(),
			}
			mockQuery.mockResolvedValueOnce({ rows: [bounty], rowCount: 1 })

			const res = await request(app).get("/api/bounties/1")
			expect(res.status).toBe(200)
			expect(res.body.bounty.title).toBe("Test")
		})

		it("returns 404 for non-existent bounty", async () => {
			const { app } = buildApp()
			mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })

			const res = await request(app).get("/api/bounties/999")
			expect(res.status).toBe(404)
		})

		it("rejects invalid ID", async () => {
			const { app } = buildApp()
			const res = await request(app).get("/api/bounties/abc")
			expect(res.status).toBe(400)
		})
	})

	describe("POST /api/bounties", () => {
		it("requires authentication", async () => {
			const { app } = buildApp()
			const res = await request(app).post("/api/bounties").send({})
			expect(res.status).toBe(401)
		})

		it("validates required fields", async () => {
			const { app } = buildApp()
			const token = makeToken(SPONSOR)
			const res = await request(app)
				.post("/api/bounties")
				.set("Authorization", `Bearer ${token}`)
				.send({})
			expect(res.status).toBe(400)
		})

		it("rejects title too short", async () => {
			const { app } = buildApp()
			const token = makeToken(SPONSOR)
			const res = await request(app)
				.post("/api/bounties")
				.set("Authorization", `Bearer ${token}`)
				.send({
					title: "Hi",
					description: "This is a long enough description for validation",
					rewardUsdc: "100",
					escrowTx: "tx123",
				})
			expect(res.status).toBe(400)
		})

		it("rejects negative reward", async () => {
			const { app } = buildApp()
			const token = makeToken(SPONSOR)
			const res = await request(app)
				.post("/api/bounties")
				.set("Authorization", `Bearer ${token}`)
				.send({
					title: "Valid title for bounty",
					description: "This is a long enough description for validation purposes",
					rewardUsdc: "-50",
					escrowTx: "tx123",
				})
			expect(res.status).toBe(400)
		})

		it("rejects missing escrow tx", async () => {
			const { app } = buildApp()
			const token = makeToken(SPONSOR)
			const res = await request(app)
				.post("/api/bounties")
				.set("Authorization", `Bearer ${token}`)
				.send({
					title: "Valid title for bounty",
					description: "This is a long enough description for validation purposes",
					rewardUsdc: "100",
				})
			expect(res.status).toBe(400)
		})

		it("creates bounty with valid escrow", async () => {
			const { app } = buildApp()
			const token = makeToken(SPONSOR)

			const bountyRow = {
				id: 1,
				sponsor_addr: SPONSOR,
				title: "Build wallet analytics",
				description: "Build a component that shows wallet analytics",
				skill_tags: ["typescript", "react"],
				reward_usdc: "250",
				escrow_tx: "abc123",
				status: "open",
				claimed_by: null,
				deadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
				payout_tx: null,
				reward_tx: null,
				approved_at: null,
				paid_at: null,
				created_at: new Date().toISOString(),
			}

			// Query 1: isEscrowTxFunded check
			mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })
			// Query 2: INSERT bounty
			mockQuery.mockResolvedValueOnce({ rows: [bountyRow], rowCount: 1 })

			const res = await request(app)
				.post("/api/bounties")
				.set("Authorization", `Bearer ${token}`)
				.send({
					title: "Build wallet analytics",
					description: "Build a component that shows wallet analytics",
					skillTags: ["typescript", "react"],
					rewardUsdc: "250",
					escrowTx: "abc123",
					claimDurationHours: 72,
				})

			expect(res.status).toBe(201)
			expect(res.body.bounty.status).toBe("open")
		})
	})

	describe("POST /api/bounties/:id/claim", () => {
		it("requires authentication", async () => {
			const { app } = buildApp()
			const res = await request(app).post("/api/bounties/1/claim")
			expect(res.status).toBe(401)
		})

		it("claims an open bounty", async () => {
			const { app } = buildApp()
			const token = makeToken(LEARNER)

			const openBounty = {
				id: 1,
				sponsor_addr: SPONSOR,
				title: "Task",
				status: "open",
				deadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
			}
			const claimedBounty = { ...openBounty, status: "claimed", claimed_by: LEARNER }

			// Query 1: getBountyById
			mockQuery.mockResolvedValueOnce({ rows: [openBounty], rowCount: 1 })
			// Client queries: BEGIN, FOR UPDATE, UPDATE, COMMIT
			mockClientQuery
				.mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
				.mockResolvedValueOnce({ rows: [openBounty], rowCount: 1 }) // FOR UPDATE
				.mockResolvedValueOnce({ rows: [claimedBounty], rowCount: 1 }) // UPDATE
				.mockResolvedValueOnce({ rows: [], rowCount: 0 }) // COMMIT

			const res = await request(app)
				.post("/api/bounties/1/claim")
				.set("Authorization", `Bearer ${token}`)

			expect(res.status).toBe(200)
			expect(res.body.bounty.status).toBe("claimed")
			expect(res.body.bounty.claimed_by).toBe(LEARNER)
		})

		it("rejects sponsor claiming own bounty", async () => {
			const { app } = buildApp()
			const token = makeToken(SPONSOR)

			const openBounty = {
				id: 1,
				sponsor_addr: SPONSOR.toLowerCase(),
				title: "Task",
				status: "open",
				deadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
			}

			// getBountyById
			mockQuery.mockResolvedValueOnce({ rows: [openBounty], rowCount: 1 })

			const res = await request(app)
				.post("/api/bounties/1/claim")
				.set("Authorization", `Bearer ${token}`)

			expect(res.status).toBe(400)
			expect(res.body.error).toContain("own")
		})

		it("prevents double-claiming", async () => {
			const { app } = buildApp()
			const token = makeToken(LEARNER2)

			const claimedBounty = {
				id: 1,
				sponsor_addr: SPONSOR,
				title: "Task",
				status: "claimed",
				claimed_by: LEARNER,
				deadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
			}

			// getBountyById
			mockQuery.mockResolvedValueOnce({ rows: [claimedBounty], rowCount: 1 })

			const res = await request(app)
				.post("/api/bounties/1/claim")
				.set("Authorization", `Bearer ${token}`)

			expect(res.status).toBe(400)
		})

		it("rejects claiming a non-existent bounty", async () => {
			const { app } = buildApp()
			const token = makeToken(LEARNER)
			// getBountyById
			mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })

			const res = await request(app)
				.post("/api/bounties/999/claim")
				.set("Authorization", `Bearer ${token}`)

			expect(res.status).toBe(404)
		})
	})

	describe("POST /api/bounties/:id/submit", () => {
		it("rejects non-claimant submission", async () => {
			const { app } = buildApp()
			const token = makeToken(LEARNER2)

			const claimedBounty = {
				id: 1,
				sponsor_addr: SPONSOR,
				title: "Task",
				status: "claimed",
				claimed_by: LEARNER,
				deadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
			}

			// getBountyById
			mockQuery.mockResolvedValueOnce({ rows: [claimedBounty], rowCount: 1 })

			const res = await request(app)
				.post("/api/bounties/1/submit")
				.set("Authorization", `Bearer ${token}`)
				.send({ repoUrl: "https://github.com/pr/1" })

			expect(res.status).toBe(403)
			expect(res.body.error).toContain("claimant")
		})

		it("allows claimant to submit work", async () => {
			const { app } = buildApp()
			const token = makeToken(LEARNER)

			const claimedBounty = {
				id: 1,
				sponsor_addr: SPONSOR,
				title: "Task",
				status: "claimed",
				claimed_by: LEARNER,
				deadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
			}
			const submission = {
				id: 1,
				bounty_id: 1,
				learner_addr: LEARNER,
				repo_url: "https://github.com/pr/1",
				notes: "Done!",
				submitted_at: new Date().toISOString(),
			}
			const submittedBounty = { ...claimedBounty, status: "submitted" }

			// getBountyById
			mockQuery.mockResolvedValueOnce({ rows: [claimedBounty], rowCount: 1 })
			// submitWork client: BEGIN, FOR UPDATE, INSERT, UPDATE, COMMIT
			mockClientQuery
				.mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
				.mockResolvedValueOnce({ rows: [claimedBounty], rowCount: 1 }) // FOR UPDATE
				.mockResolvedValueOnce({ rows: [submission], rowCount: 1 }) // INSERT
				.mockResolvedValueOnce({ rows: [submittedBounty], rowCount: 1 }) // UPDATE
				.mockResolvedValueOnce({ rows: [], rowCount: 0 }) // COMMIT

			const res = await request(app)
				.post("/api/bounties/1/submit")
				.set("Authorization", `Bearer ${token}`)
				.send({ repoUrl: "https://github.com/pr/1", notes: "Done!" })

			expect(res.status).toBe(200)
			expect(res.body.bounty.status).toBe("submitted")
		})

		it("rejects submission without repo or notes", async () => {
			const { app } = buildApp()
			const token = makeToken(LEARNER)
			const res = await request(app)
				.post("/api/bounties/1/submit")
				.set("Authorization", `Bearer ${token}`)
				.send({})
			expect(res.status).toBe(400)
		})
	})

	describe("POST /api/bounties/:id/approve", () => {
		it("rejects non-sponsor approval", async () => {
			const { app } = buildApp()
			const token = makeToken(LEARNER)

			const submittedBounty = {
				id: 1,
				sponsor_addr: SPONSOR.toLowerCase(),
				title: "Task",
				status: "submitted",
			}

			// getBountyById
			mockQuery.mockResolvedValueOnce({ rows: [submittedBounty], rowCount: 1 })

			const res = await request(app)
				.post("/api/bounties/1/approve")
				.set("Authorization", `Bearer ${token}`)

			expect(res.status).toBe(403)
		})

		it("allows sponsor to approve submitted bounty", async () => {
			const { app } = buildApp()
			const token = makeToken(SPONSOR)

			const submittedBounty = {
				id: 1,
				sponsor_addr: SPONSOR.toLowerCase(),
				title: "Task",
				status: "submitted",
				reward_usdc: "250",
			}
			const submission = {
				id: 1,
				bounty_id: 1,
				learner_addr: LEARNER,
				repo_url: "https://github.com/pr/1",
				notes: "Done!",
				submitted_at: new Date().toISOString(),
			}
			const paidBounty = {
				...submittedBounty,
				status: "paid",
				payout_tx: "bounty-release-1-123",
				reward_tx: "bounty-lrn-1-123",
			}

			// 1. getBountyById (controller)
			mockQuery.mockResolvedValueOnce({ rows: [submittedBounty], rowCount: 1 })
			// 2. getSubmissionByBounty (controller)
			mockQuery.mockResolvedValueOnce({ rows: [submission], rowCount: 1 })
			// 3. getBountyById (releaseEscrow service)
			mockQuery.mockResolvedValueOnce({ rows: [submittedBounty], rowCount: 1 })
			// 4. getBountyById (mintLrnReward service)
			mockQuery.mockResolvedValueOnce({ rows: [submittedBounty], rowCount: 1 })
			// 5. approveSubmission UPDATE
			mockQuery.mockResolvedValueOnce({ rows: [paidBounty], rowCount: 1 })

			const res = await request(app)
				.post("/api/bounties/1/approve")
				.set("Authorization", `Bearer ${token}`)

			expect(res.status).toBe(200)
			expect(res.body.bounty.status).toBe("paid")
			expect(res.body.payout.usdc.success).toBe(true)
			expect(res.body.payout.lrn.success).toBe(true)
		})

		it("rejects approving non-submitted bounty", async () => {
			const { app } = buildApp()
			const token = makeToken(SPONSOR)

			const openBounty = {
				id: 1,
				sponsor_addr: SPONSOR.toLowerCase(),
				title: "Task",
				status: "open",
			}

			// getBountyById
			mockQuery.mockResolvedValueOnce({ rows: [openBounty], rowCount: 1 })

			const res = await request(app)
				.post("/api/bounties/1/approve")
				.set("Authorization", `Bearer ${token}`)

			expect(res.status).toBe(400)
		})

		it("does not double-pay on duplicate approval", async () => {
			const { app } = buildApp()
			const token = makeToken(SPONSOR)

			const alreadyPaidBounty = {
				id: 1,
				sponsor_addr: SPONSOR.toLowerCase(),
				title: "Task",
				status: "paid",
				reward_usdc: "250",
			}

			// getBountyById
			mockQuery.mockResolvedValueOnce({ rows: [alreadyPaidBounty], rowCount: 1 })

			const res = await request(app)
				.post("/api/bounties/1/approve")
				.set("Authorization", `Bearer ${token}`)

			expect(res.status).toBe(400)
		})
	})

	describe("POST /api/bounties/:id/cancel", () => {
		it("rejects non-sponsor cancellation", async () => {
			const { app } = buildApp()
			const token = makeToken(LEARNER)

			const openBounty = {
				id: 1,
				sponsor_addr: SPONSOR.toLowerCase(),
				title: "Task",
				status: "open",
			}

			// getBountyById
			mockQuery.mockResolvedValueOnce({ rows: [openBounty], rowCount: 1 })

			const res = await request(app)
				.post("/api/bounties/1/cancel")
				.set("Authorization", `Bearer ${token}`)

			expect(res.status).toBe(403)
		})

		it("allows sponsor to cancel open bounty", async () => {
			const { app } = buildApp()
			const token = makeToken(SPONSOR)

			const openBounty = {
				id: 1,
				sponsor_addr: SPONSOR.toLowerCase(),
				title: "Task",
				status: "open",
			}
			const cancelledBounty = { ...openBounty, status: "cancelled" }

			// getBountyById
			mockQuery.mockResolvedValueOnce({ rows: [openBounty], rowCount: 1 })
			// cancelBounty UPDATE
			mockQuery.mockResolvedValueOnce({ rows: [cancelledBounty], rowCount: 1 })

			const res = await request(app)
				.post("/api/bounties/1/cancel")
				.set("Authorization", `Bearer ${token}`)

			expect(res.status).toBe(200)
			expect(res.body.bounty.status).toBe("cancelled")
		})
	})
})

describe("Bounty State Machine", () => {
	it("allows open -> claimed", () => {
		expect(isValidTransition("open", "claimed")).toBe(true)
	})

	it("allows open -> cancelled", () => {
		expect(isValidTransition("open", "cancelled")).toBe(true)
	})

	it("allows claimed -> submitted", () => {
		expect(isValidTransition("claimed", "submitted")).toBe(true)
	})

	it("allows claimed -> open (expiry)", () => {
		expect(isValidTransition("claimed", "open")).toBe(true)
	})

	it("allows claimed -> cancelled", () => {
		expect(isValidTransition("claimed", "cancelled")).toBe(true)
	})

	it("allows submitted -> approved", () => {
		expect(isValidTransition("submitted", "approved")).toBe(true)
	})

	it("allows approved -> paid", () => {
		expect(isValidTransition("approved", "paid")).toBe(true)
	})

	it("rejects open -> submitted", () => {
		expect(isValidTransition("open", "submitted")).toBe(false)
	})

	it("rejects open -> paid", () => {
		expect(isValidTransition("open", "paid")).toBe(false)
	})

	it("rejects paid -> open", () => {
		expect(isValidTransition("paid", "open")).toBe(false)
	})

	it("rejects cancelled -> open", () => {
		expect(isValidTransition("cancelled", "open")).toBe(false)
	})

	it("rejects open -> approved", () => {
		expect(isValidTransition("open", "approved")).toBe(false)
	})

	it("rejects submitted -> open", () => {
		expect(isValidTransition("submitted", "open")).toBe(false)
	})

	it("rejects approved -> open", () => {
		expect(isValidTransition("approved", "open")).toBe(false)
	})
})
