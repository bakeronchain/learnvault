/**
 * Integration tests for the admin milestone verification API.
 * Uses the in-memory store so no database is required.
 */

jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
		connect: jest.fn(),
	},
}))

jest.mock("../services/stellar-contract.service", () => ({
	stellarContractService: {
		callVerifyMilestone: jest
			.fn()
			.mockResolvedValue({ txHash: "test_tx_hash", simulated: false }),
		emitRejectionEvent: jest
			.fn()
			.mockResolvedValue({ txHash: "test_tx_hash", simulated: false }),
		callMintScholarNFT: jest
			.fn()
			.mockResolvedValue({ txHash: "test_tx_hash", simulated: false }),
	},
}))

jest.mock("../services/email.service", () => ({
	createEmailService: jest.fn().mockReturnValue({
		sendNotification: jest.fn().mockResolvedValue(undefined),
		sendAdminMilestoneNotification: jest.fn().mockResolvedValue(undefined),
	}),
}))

jest.mock("../services/escrow-timeout.service", () => ({
	markEscrowActivity: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("../services/credential.service", () => ({
	credentialService: {
		mintCertificateIfComplete: jest
			.fn()
			.mockResolvedValue({ minted: false }),
	},
}))

import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { inMemoryMilestoneStore } from "../db/milestone-store"
import { resetPeerReviewMemoryForTests } from "../db/peer-review-store"
import { errorHandler } from "../middleware/error.middleware"
import { adminMilestonesRouter } from "../routes/admin-milestones.routes"
import { stellarContractService } from "../services/stellar-contract.service"

const JWT_SECRET = "learnvault-secret"
process.env.JWT_SECRET = JWT_SECRET

function makeAdminToken(address = "GADMIN123") {
	return jwt.sign({ address }, JWT_SECRET, { expiresIn: "1h" })
}

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use("/api", adminMilestonesRouter)
	app.use(errorHandler)
	return app
}

// Reset in-memory store before each test
beforeEach(() => {
	jest.clearAllMocks()

	// @ts-ignore – reset private fields for test isolation
	inMemoryMilestoneStore["reports"] = []
	// @ts-ignore
	inMemoryMilestoneStore["auditLog"] = []
	// @ts-ignore
	inMemoryMilestoneStore["reportSeq"] = 1
	// @ts-ignore
	inMemoryMilestoneStore["auditSeq"] = 1
	resetPeerReviewMemoryForTests()

	// Provide fake Stellar credentials so the approve/reject credential guard
	// passes — the pool mock ensures no real SDK call is made.
	process.env.STELLAR_SECRET_KEY = "FAKE_TEST_KEY"
	process.env.COURSE_MILESTONE_CONTRACT_ID = "FAKE_TEST_CONTRACT"
	process.env.FRONTEND_URL = "http://localhost:3000"
	process.env.NODE_ENV = "test"
})

afterEach(() => {
	delete process.env.STELLAR_SECRET_KEY
	delete process.env.COURSE_MILESTONE_CONTRACT_ID
	delete process.env.FRONTEND_URL
	delete process.env.NODE_ENV
})

describe("POST /api/milestones/submit", () => {
	it("creates a report with valid payload", async () => {
		const app = buildApp()
		const res = await request(app).post("/api/milestones/submit").send({
			scholarAddress: "GSCHOLAR1",
			courseId: "stellar-basics",
			milestoneId: 1,
			evidenceDescription: "Completed all exercises",
		})

		expect(res.status).toBe(201)
		expect(res.body.data.status).toBe("pending")
		expect(res.body.data.scholar_address).toBe("GSCHOLAR1")
	})

	it("rejects submission with no evidence", async () => {
		const app = buildApp()
		const res = await request(app).post("/api/milestones/submit").send({
			scholarAddress: "GSCHOLAR1",
			courseId: "stellar-basics",
			milestoneId: 1,
		})

		expect(res.status).toBe(400)
	})

	it("returns 409 on duplicate submission", async () => {
		const app = buildApp()
		const payload = {
			scholarAddress: "GSCHOLAR1",
			courseId: "stellar-basics",
			milestoneId: 1,
			evidenceDescription: "First attempt",
		}

		await request(app).post("/api/milestones/submit").send(payload)
		const res = await request(app).post("/api/milestones/submit").send(payload)

		expect(res.status).toBe(409)
	})

	it("returns field-level validation errors for invalid payloads", async () => {
		const app = buildApp()
		const res = await request(app).post("/api/milestones/submit").send({
			scholarAddress: "",
			courseId: "stellar-basics",
			milestoneId: 1,
		})

		expect(res.status).toBe(400)
		expect(res.body.error).toBe("Validation failed")
		expect(res.body.details).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					field: "scholarAddress",
					message: "scholarAddress is required",
				}),
				expect.objectContaining({
					field: "evidenceGithub",
				}),
			]),
		)
	})
})

describe("POST /api/milestones", () => {
	it("creates a report with the issue payload shape", async () => {
		const app = buildApp()
		const res = await request(app).post("/api/milestones").send({
			learner_address: "GSCHOLAR2",
			course_id: "stellar-basics",
			milestone_id: 2,
			evidence_url: "https://example.com/evidence",
		})

		expect(res.status).toBe(201)
		expect(res.body.data.scholar_address).toBe("GSCHOLAR2")
		expect(res.body.data.evidence_github).toBe("https://example.com/evidence")
	})
})

describe("GET /api/admin/milestones/pending", () => {
	it("returns 401 without token", async () => {
		const app = buildApp()
		const res = await request(app).get("/api/admin/milestones/pending")
		expect(res.status).toBe(401)
	})

	it("returns pending reports for admin", async () => {
		// Seed a report
		await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 1,
			evidence_description: "Done",
			evidence_github: null,
			evidence_ipfs_cid: null,
		})

		const app = buildApp()
		const res = await request(app)
			.get("/api/admin/milestones/pending")
			.set("Authorization", `Bearer ${makeAdminToken()}`)

		expect(res.status).toBe(200)
		expect(res.body.data).toHaveLength(1)
		expect(res.body.data[0].status).toBe("pending")
		expect(res.body.data[0].peer_approval_count).toBe(0)
		expect(res.body.data[0].peer_rejection_count).toBe(0)
	})
})

describe("GET /api/admin/milestones/:id", () => {
	it("returns 404 for unknown id", async () => {
		const app = buildApp()
		const res = await request(app)
			.get("/api/admin/milestones/999")
			.set("Authorization", `Bearer ${makeAdminToken()}`)

		expect(res.status).toBe(404)
	})

	it("returns report with audit log", async () => {
		const report = await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 1,
			evidence_description: "Done",
			evidence_github: null,
			evidence_ipfs_cid: null,
		})

		const app = buildApp()
		const res = await request(app)
			.get(`/api/admin/milestones/${report.id}`)
			.set("Authorization", `Bearer ${makeAdminToken()}`)

		expect(res.status).toBe(200)
		expect(res.body.data.id).toBe(report.id)
		expect(Array.isArray(res.body.data.auditLog)).toBe(true)
		expect(Array.isArray(res.body.data.peer_reviews)).toBe(true)
		expect(res.body.data.peer_approval_count).toBe(0)
		expect(res.body.data.peer_rejection_count).toBe(0)
	})
})

describe("POST /api/admin/milestones/:id/approve", () => {
	it("approves a pending report and records audit entry", async () => {
		const report = await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 1,
			evidence_description: "Done",
			evidence_github: null,
			evidence_ipfs_cid: null,
		})

		const app = buildApp()
		const res = await request(app)
			.post(`/api/admin/milestones/${report.id}/approve`)
			.set("Authorization", `Bearer ${makeAdminToken()}`)

		expect(res.status).toBe(200)
		expect(res.body.data.status).toBe("approved")
		expect(res.body.data.auditEntry.decision).toBe("approved")
		expect(res.body.data.auditEntry.validator_address).toBe("GADMIN123")
	})

	it("returns 409 when approving an already-approved report", async () => {
		const report = await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 1,
			evidence_description: "Done",
			evidence_github: null,
			evidence_ipfs_cid: null,
		})
		await inMemoryMilestoneStore.updateReportStatus(report.id, "approved")

		const app = buildApp()
		const res = await request(app)
			.post(`/api/admin/milestones/${report.id}/approve`)
			.set("Authorization", `Bearer ${makeAdminToken()}`)

		expect(res.status).toBe(409)
	})

	it("returns field-level validation errors when note is invalid", async () => {
		const report = await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 1,
			evidence_description: "Done",
			evidence_github: null,
			evidence_ipfs_cid: null,
		})

		const app = buildApp()
		const res = await request(app)
			.post(`/api/admin/milestones/${report.id}/approve`)
			.set("Authorization", `Bearer ${makeAdminToken()}`)
			.send({ note: 123 })

		expect(res.status).toBe(400)
		expect(res.body.details).toEqual([
			{
				field: "note",
				message: "note must be a string",
			},
		])
	})
})

describe("POST /api/admin/milestones/batch-approve", () => {
	it("approves multiple pending reports and returns per-report results", async () => {
		const reportOne = await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 1,
			evidence_description: "Done",
			evidence_github: null,
			evidence_ipfs_cid: null,
		})
		const reportTwo = await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GSCHOLAR2",
			course_id: "stellar-basics",
			milestone_id: 2,
			evidence_description: "Done again",
			evidence_github: null,
			evidence_ipfs_cid: null,
		})

		const app = buildApp()
		const res = await request(app)
			.post("/api/admin/milestones/batch-approve")
			.set("Authorization", `Bearer ${makeAdminToken()}`)
			.send({ milestoneIds: [reportOne.id, reportTwo.id] })

		expect(res.status).toBe(200)
		expect(res.body.data.succeeded).toBe(2)
		expect(res.body.data.results).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					reportId: reportOne.id,
					success: true,
					status: "approved",
				}),
				expect.objectContaining({
					reportId: reportTwo.id,
					success: true,
					status: "approved",
				}),
			]),
		)
	})

	it("fails validation before processing when any report is not pending", async () => {
		const reportOne = await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 1,
			evidence_description: "Done",
			evidence_github: null,
			evidence_ipfs_cid: null,
		})
		const reportTwo = await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GSCHOLAR2",
			course_id: "stellar-basics",
			milestone_id: 2,
			evidence_description: "Done again",
			evidence_github: null,
			evidence_ipfs_cid: null,
		})
		await inMemoryMilestoneStore.updateReportStatus(reportTwo.id, "approved")

		const app = buildApp()
		const res = await request(app)
			.post("/api/admin/milestones/batch-approve")
			.set("Authorization", `Bearer ${makeAdminToken()}`)
			.send({ milestoneIds: [reportOne.id, reportTwo.id] })

		expect(res.status).toBe(409)
		expect(res.body.data.results).toEqual([
			expect.objectContaining({
				reportId: reportTwo.id,
				success: false,
				status: "approved",
			}),
		])
		expect(stellarContractService.callVerifyMilestone).not.toHaveBeenCalled()
	})
})

describe("POST /api/admin/milestones/:id/reject", () => {
	it("rejects a pending report with a reason", async () => {
		const report = await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 1,
			evidence_description: "Done",
			evidence_github: null,
			evidence_ipfs_cid: null,
		})

		const app = buildApp()
		const res = await request(app)
			.post(`/api/admin/milestones/${report.id}/reject`)
			.set("Authorization", `Bearer ${makeAdminToken()}`)
			.send({ reason: "Evidence is insufficient" })

		expect(res.status).toBe(200)
		expect(res.body.data.status).toBe("rejected")
		expect(res.body.data.reason).toBe("Evidence is insufficient")
		expect(res.body.data.auditEntry.rejection_reason).toBe(
			"Evidence is insufficient",
		)
	})

	it("returns 400 when reason is missing", async () => {
		const report = await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 1,
			evidence_description: "Done",
			evidence_github: null,
			evidence_ipfs_cid: null,
		})

		const app = buildApp()
		const res = await request(app)
			.post(`/api/admin/milestones/${report.id}/reject`)
			.set("Authorization", `Bearer ${makeAdminToken()}`)
			.send({})

		expect(res.status).toBe(400)
		expect(res.body.details).toEqual([
			{
				field: "reason",
				message: "reason is required",
			},
		])
	})
})

describe("POST /api/admin/milestones/batch-reject", () => {
	it("rejects multiple pending reports and returns per-report results", async () => {
		const reportOne = await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 1,
			evidence_description: "Done",
			evidence_github: null,
			evidence_ipfs_cid: null,
		})
		const reportTwo = await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GSCHOLAR2",
			course_id: "stellar-basics",
			milestone_id: 2,
			evidence_description: "Done again",
			evidence_github: null,
			evidence_ipfs_cid: null,
		})

		const app = buildApp()
		const res = await request(app)
			.post("/api/admin/milestones/batch-reject")
			.set("Authorization", `Bearer ${makeAdminToken()}`)
			.send({
				milestoneIds: [reportOne.id, reportTwo.id],
				reason: "Needs more evidence",
			})

		expect(res.status).toBe(200)
		expect(res.body.data.succeeded).toBe(2)
		expect(res.body.data.results).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					reportId: reportOne.id,
					success: true,
					status: "rejected",
					reason: "Needs more evidence",
				}),
				expect.objectContaining({
					reportId: reportTwo.id,
					success: true,
					status: "rejected",
					reason: "Needs more evidence",
				}),
			]),
		)
	})
})

describe("error handling", () => {
	it("returns 503 when Stellar credentials are not configured", async () => {
		const report = await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 1,
			evidence_description: "Done",
			evidence_github: null,
			evidence_ipfs_cid: null,
		})

		// Mock the service to throw the 'not configured' error
		const mockedService =
			stellarContractService.callVerifyMilestone as jest.Mock
		mockedService.mockRejectedValueOnce(
			new Error(
				"STELLAR_SECRET_KEY not configured — cannot submit on-chain transaction",
			),
		)

		const app = buildApp()
		const res = await request(app)
			.post(`/api/admin/milestones/${report.id}/approve`)
			.set("Authorization", `Bearer ${makeAdminToken()}`)

		expect(res.status).toBe(503)
		expect(res.body.error).toBe("Stellar credentials not configured")
	})
})
