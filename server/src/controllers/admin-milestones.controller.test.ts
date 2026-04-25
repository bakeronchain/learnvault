/**
 * Unit tests for admin-milestones controller.
 *
 * All external dependencies (DB, Stellar, credential service) are mocked so
 * tests run in isolation without a database or Stellar SDK.
 *
 * Covers:
 *   POST /api/admin/milestones/:id/approve
 *     - happy path: pending → approved, real txHash returned
 *     - 404 report not found
 *     - 409 already approved
 *     - 503 missing Stellar credentials
 *   POST /api/admin/milestones/:id/reject
 *     - happy path: pending → rejected, reason stored
 *     - 400 missing reason field
 *   GET /api/admin/milestones/pending
 *     - returns only pending reports
 */

// Must be declared before any imports so Jest hoisting works correctly.
jest.mock("../db/index", () => ({
	pool: { query: jest.fn(), connect: jest.fn() },
}))
jest.mock("../db/milestone-store")
jest.mock("../services/stellar-contract.service")
jest.mock("../services/credential.service")

jest.mock("../services/email.service", () => ({
	createEmailService: jest.fn().mockReturnValue({
		sendNotification: jest.fn().mockResolvedValue(undefined),
	}),
}))

jest.mock("../services/escrow-timeout.service", () => ({
	markEscrowActivity: jest.fn().mockResolvedValue(undefined),
}))

import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"

import { milestoneStore } from "../db/milestone-store"
import { errorHandler } from "../middleware/error.middleware"
import { adminMilestonesRouter } from "../routes/admin-milestones.routes"
import { credentialService } from "../services/credential.service"
import { stellarContractService } from "../services/stellar-contract.service"

// ── Typed mock helpers ───────────────────────────────────────────────────────

const mockStore = milestoneStore as jest.Mocked<typeof milestoneStore>
const mockStellar = stellarContractService as jest.Mocked<
	typeof stellarContractService
>
const mockCredential = credentialService as jest.Mocked<
	typeof credentialService
>

// ── Shared fixtures ──────────────────────────────────────────────────────────

const JWT_SECRET = "learnvault-secret"

const pendingReport = {
	id: 1,
	scholar_address: "GSCHOLAR1",
	course_id: "stellar-basics",
	milestone_id: 1,
	evidence_github: null,
	evidence_ipfs_cid: null,
	evidence_description: "Completed all exercises",
	status: "pending" as const,
	submitted_at: new Date().toISOString(),
	resubmission_count: 0,
	scholar_email: "scholar@example.com",
	scholar_name: "Test Scholar",
	course_title: "Test Course",
	milestone_title: "Test Milestone",
	milestone_number: 1,
	lrn_reward: 100,
}

const approvedAuditEntry = {
	id: 1,
	report_id: 1,
	validator_address: "GADMIN123",
	decision: "approved" as const,
	rejection_reason: null,
	contract_tx_hash: "real_tx_hash_abc",
	decided_at: new Date().toISOString(),
}

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

// ── Test lifecycle ───────────────────────────────────────────────────────────

beforeEach(() => {
	jest.clearAllMocks()

	// Default happy-path stubs — individual tests override as needed.
	mockStellar.callVerifyMilestone.mockResolvedValue({
		txHash: "real_tx_hash_abc",
		simulated: false,
	})
	mockStellar.emitRejectionEvent.mockResolvedValue({
		txHash: "reject_tx_hash_xyz",
		simulated: false,
	})
	mockStore.updateReportStatus.mockResolvedValue({
		...pendingReport,
		status: "approved",
	})
	mockStore.addAuditEntry.mockResolvedValue(approvedAuditEntry)
	mockCredential.mintCertificateIfComplete.mockResolvedValue({ minted: false })

	// Provide Stellar credentials so the controller's 503 guard passes by
	// default. The 503 test removes them explicitly.
	process.env.STELLAR_SECRET_KEY = "FAKE_TEST_SECRET"
	process.env.COURSE_MILESTONE_CONTRACT_ID = "FAKE_CONTRACT_ID"
	process.env.FRONTEND_URL = "http://localhost:3000"
})

afterEach(() => {
	delete process.env.STELLAR_SECRET_KEY
	delete process.env.COURSE_MILESTONE_CONTRACT_ID
	delete process.env.FRONTEND_URL
})

// ── GET /api/admin/milestones/pending ────────────────────────────────────────

describe("GET /api/admin/milestones/pending", () => {
	it("returns only pending reports for an authenticated admin", async () => {
		mockStore.getPendingReports.mockResolvedValue([pendingReport])

		const res = await request(buildApp())
			.get("/api/admin/milestones/pending")
			.set("Authorization", `Bearer ${makeAdminToken()}`)

		expect(res.status).toBe(200)
		expect(res.body.data).toHaveLength(1)
		expect(res.body.data[0].status).toBe("pending")
		expect(res.body.data[0].id).toBe(1)
	})

	it("returns an empty array when no pending reports exist", async () => {
		mockStore.getPendingReports.mockResolvedValue([])

		const res = await request(buildApp())
			.get("/api/admin/milestones/pending")
			.set("Authorization", `Bearer ${makeAdminToken()}`)

		expect(res.status).toBe(200)
		expect(res.body.data).toHaveLength(0)
	})

	it("returns 401 without an auth token", async () => {
		const res = await request(buildApp()).get("/api/admin/milestones/pending")

		expect(res.status).toBe(401)
		expect(mockStore.getPendingReports).not.toHaveBeenCalled()
	})
})

// ── POST /api/admin/milestones/:id/approve ───────────────────────────────────

describe("POST /api/admin/milestones/:id/approve", () => {
	it("happy path: transitions pending → approved and returns real txHash", async () => {
		mockStore.getReportById.mockResolvedValue(pendingReport)

		const res = await request(buildApp())
			.post("/api/admin/milestones/1/approve")
			.set("Authorization", `Bearer ${makeAdminToken()}`)

		expect(res.status).toBe(200)
		expect(res.body.data.status).toBe("approved")
		expect(res.body.data.contractTxHash).toBe("real_tx_hash_abc")
		expect(res.body.data.simulated).toBe(false)
		expect(res.body.data.auditEntry.decision).toBe("approved")
		expect(res.body.data.auditEntry.validator_address).toBe("GADMIN123")

		expect(mockStore.updateReportStatus).toHaveBeenCalledWith(1, "approved")
		expect(mockStore.addAuditEntry).toHaveBeenCalledWith(
			expect.objectContaining({
				report_id: 1,
				decision: "approved",
				contract_tx_hash: "real_tx_hash_abc",
			}),
		)
	})

	it("returns 404 when the milestone report does not exist", async () => {
		mockStore.getReportById.mockResolvedValue(null)

		const res = await request(buildApp())
			.post("/api/admin/milestones/999/approve")
			.set("Authorization", `Bearer ${makeAdminToken()}`)

		expect(res.status).toBe(404)
		expect(res.body.error).toBe("Milestone report not found")
		expect(mockStellar.callVerifyMilestone).not.toHaveBeenCalled()
	})

	it("returns 409 when the report is already approved", async () => {
		mockStore.getReportById.mockResolvedValue({
			...pendingReport,
			status: "approved",
		})

		const res = await request(buildApp())
			.post("/api/admin/milestones/1/approve")
			.set("Authorization", `Bearer ${makeAdminToken()}`)

		expect(res.status).toBe(409)
		expect(res.body.error).toMatch(/already approved/i)
		expect(mockStellar.callVerifyMilestone).not.toHaveBeenCalled()
	})

	it("returns 409 when the report is already rejected", async () => {
		mockStore.getReportById.mockResolvedValue({
			...pendingReport,
			status: "rejected",
		})

		const res = await request(buildApp())
			.post("/api/admin/milestones/1/approve")
			.set("Authorization", `Bearer ${makeAdminToken()}`)

		expect(res.status).toBe(409)
		expect(mockStellar.callVerifyMilestone).not.toHaveBeenCalled()
	})

	it("returns 503 when Stellar credentials are not configured", async () => {
		delete process.env.STELLAR_SECRET_KEY
		delete process.env.COURSE_MILESTONE_CONTRACT_ID

		mockStore.getReportById.mockResolvedValue(pendingReport)

		const res = await request(buildApp())
			.post("/api/admin/milestones/1/approve")
			.set("Authorization", `Bearer ${makeAdminToken()}`)

		expect(res.status).toBe(503)
		expect(res.body.error).toBe("Stellar credentials not configured")
		// Must not proceed to the on-chain call or DB write
		expect(mockStellar.callVerifyMilestone).not.toHaveBeenCalled()
		expect(mockStore.updateReportStatus).not.toHaveBeenCalled()
	})

	it("includes certificate data when all milestones are complete", async () => {
		mockStore.getReportById.mockResolvedValue(pendingReport)
		mockCredential.mintCertificateIfComplete.mockResolvedValue({
			minted: true,
			tokenUri: "ipfs://Qm...",
			mintTxHash: "mint_hash_abc",
			simulated: false,
		})

		const res = await request(buildApp())
			.post("/api/admin/milestones/1/approve")
			.set("Authorization", `Bearer ${makeAdminToken()}`)

		expect(res.status).toBe(200)
		expect(res.body.data.certificate).toMatchObject({
			minted: true,
			mintTxHash: "mint_hash_abc",
		})
	})
})

describe("POST /api/admin/milestones/batch-approve", () => {
	it("approves every requested pending report and returns per-report results", async () => {
		mockStore.getReportById
			.mockResolvedValueOnce(pendingReport)
			.mockResolvedValueOnce({
				...pendingReport,
				id: 2,
				milestone_id: 2,
			})
		mockStore.addAuditEntry
			.mockResolvedValueOnce(approvedAuditEntry)
			.mockResolvedValueOnce({
				...approvedAuditEntry,
				id: 2,
				report_id: 2,
			})

		const res = await request(buildApp())
			.post("/api/admin/milestones/batch-approve")
			.set("Authorization", `Bearer ${makeAdminToken()}`)
			.send({ milestoneIds: [1, 2] })

		expect(res.status).toBe(200)
		expect(res.body.data.succeeded).toBe(2)
		expect(res.body.data.failed).toBe(0)
		expect(res.body.data.results).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					reportId: 1,
					success: true,
					status: "approved",
				}),
				expect.objectContaining({
					reportId: 2,
					success: true,
					status: "approved",
				}),
			]),
		)
		expect(mockStore.updateReportStatus).toHaveBeenNthCalledWith(
			1,
			1,
			"approved",
		)
		expect(mockStore.updateReportStatus).toHaveBeenNthCalledWith(
			2,
			2,
			"approved",
		)
	})

	it("returns 404 when any milestone in the batch does not exist", async () => {
		mockStore.getReportById
			.mockResolvedValueOnce(pendingReport)
			.mockResolvedValueOnce(null)

		const res = await request(buildApp())
			.post("/api/admin/milestones/batch-approve")
			.set("Authorization", `Bearer ${makeAdminToken()}`)
			.send({ milestoneIds: [1, 999] })

		expect(res.status).toBe(404)
		expect(res.body.error).toBe("One or more milestone reports were not found")
		expect(res.body.data.results).toEqual([
			expect.objectContaining({
				reportId: 999,
				success: false,
				status: "not_found",
			}),
		])
		expect(mockStellar.callVerifyMilestone).not.toHaveBeenCalled()
	})
})

// ── POST /api/admin/milestones/:id/reject ────────────────────────────────────

describe("POST /api/admin/milestones/:id/reject", () => {
	it("happy path: transitions pending → rejected and stores the reason", async () => {
		mockStore.getReportById.mockResolvedValue(pendingReport)
		mockStore.updateReportStatus.mockResolvedValue({
			...pendingReport,
			status: "rejected",
		})
		mockStore.addAuditEntry.mockResolvedValue({
			...approvedAuditEntry,
			decision: "rejected",
			rejection_reason: "Insufficient evidence",
			contract_tx_hash: "reject_tx_hash_xyz",
		})

		const res = await request(buildApp())
			.post("/api/admin/milestones/1/reject")
			.set("Authorization", `Bearer ${makeAdminToken()}`)
			.send({ reason: "Insufficient evidence" })

		expect(res.status).toBe(200)
		expect(res.body.data.status).toBe("rejected")
		expect(res.body.data.reason).toBe("Insufficient evidence")
		expect(res.body.data.auditEntry.rejection_reason).toBe(
			"Insufficient evidence",
		)
		expect(res.body.data.contractTxHash).toBe("reject_tx_hash_xyz")

		expect(mockStore.updateReportStatus).toHaveBeenCalledWith(1, "rejected")
		expect(mockStore.addAuditEntry).toHaveBeenCalledWith(
			expect.objectContaining({
				report_id: 1,
				decision: "rejected",
				rejection_reason: "Insufficient evidence",
			}),
		)
	})

	it("returns 400 when the reason field is missing", async () => {
		mockStore.getReportById.mockResolvedValue(pendingReport)

		const res = await request(buildApp())
			.post("/api/admin/milestones/1/reject")
			.set("Authorization", `Bearer ${makeAdminToken()}`)
			.send({})

		expect(res.status).toBe(400)
		expect(res.body.details).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					field: "reason",
					message: "reason is required",
				}),
			]),
		)
		expect(mockStore.updateReportStatus).not.toHaveBeenCalled()
	})

	it("returns 404 when the milestone report does not exist", async () => {
		mockStore.getReportById.mockResolvedValue(null)

		const res = await request(buildApp())
			.post("/api/admin/milestones/999/reject")
			.set("Authorization", `Bearer ${makeAdminToken()}`)
			.send({ reason: "Does not qualify" })

		expect(res.status).toBe(404)
		expect(res.body.error).toBe("Milestone report not found")
	})

	it("returns 409 when the report is already rejected", async () => {
		mockStore.getReportById.mockResolvedValue({
			...pendingReport,
			status: "rejected",
		})

		const res = await request(buildApp())
			.post("/api/admin/milestones/1/reject")
			.set("Authorization", `Bearer ${makeAdminToken()}`)
			.send({ reason: "Re-rejection attempt" })

		expect(res.status).toBe(409)
	})

	it("returns 401 without an auth token", async () => {
		const res = await request(buildApp())
			.post("/api/admin/milestones/1/reject")
			.send({ reason: "No auth" })

		expect(res.status).toBe(401)
		expect(mockStore.getReportById).not.toHaveBeenCalled()
	})
})

describe("POST /api/admin/milestones/batch-reject", () => {
	it("returns 409 when any report is already processed before the batch starts", async () => {
		mockStore.getReportById
			.mockResolvedValueOnce(pendingReport)
			.mockResolvedValueOnce({
				...pendingReport,
				id: 2,
				status: "approved",
			})

		const res = await request(buildApp())
			.post("/api/admin/milestones/batch-reject")
			.set("Authorization", `Bearer ${makeAdminToken()}`)
			.send({ milestoneIds: [1, 2], reason: "Batch reject" })

		expect(res.status).toBe(409)
		expect(res.body.error).toBe(
			"All milestone reports must be pending before batch processing",
		)
		expect(res.body.data.results).toEqual([
			expect.objectContaining({
				reportId: 2,
				success: false,
				status: "approved",
			}),
		])
		expect(mockStellar.emitRejectionEvent).not.toHaveBeenCalled()
	})
})
