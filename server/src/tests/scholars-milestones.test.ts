/**
 * Integration tests for scholar milestone history endpoint.
 * Uses the in-memory store so no database is required.
 */

jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn(),
		connect: jest.fn(),
	},
}))

import express from "express"
import request from "supertest"

import { pool } from "../db/index"
import { inMemoryMilestoneStore } from "../db/milestone-store"
import { errorHandler } from "../middleware/error.middleware"
import { scholarsRouter } from "../routes/scholars.routes"

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use("/api", scholarsRouter)
	app.use(errorHandler)
	return app
}

beforeEach(() => {
	;(pool.query as jest.Mock).mockReset()
	;(pool.query as jest.Mock).mockResolvedValue({ rows: [] })
	// @ts-ignore – reset private fields for test isolation
	inMemoryMilestoneStore["reports"] = []
	// @ts-ignore
	inMemoryMilestoneStore["auditLog"] = []
	// @ts-ignore
	inMemoryMilestoneStore["reportSeq"] = 1
	// @ts-ignore
	inMemoryMilestoneStore["auditSeq"] = 1
})

describe("GET /api/scholars/:address/milestones", () => {
	it("returns milestone history with decision metadata", async () => {
		const approvedReport = await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 2,
			evidence_github: "https://example.com/evidence",
			evidence_ipfs_cid: null,
			evidence_description: null,
		})

		await inMemoryMilestoneStore.updateReportStatus(
			approvedReport.id,
			"approved",
		)
		await inMemoryMilestoneStore.addAuditEntry({
			report_id: approvedReport.id,
			validator_address: "GADMIN123",
			decision: "approved",
			rejection_reason: null,
			contract_tx_hash: "abc123",
		})

		await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 3,
			evidence_github: "https://example.com/pending",
			evidence_ipfs_cid: null,
			evidence_description: null,
		})

		const rejectedReport = await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 4,
			evidence_github: "https://example.com/rejected",
			evidence_ipfs_cid: null,
			evidence_description: null,
		})

		await inMemoryMilestoneStore.updateReportStatus(
			rejectedReport.id,
			"rejected",
		)
		await inMemoryMilestoneStore.addAuditEntry({
			report_id: rejectedReport.id,
			validator_address: "GADMIN123",
			decision: "rejected",
			rejection_reason: "No evidence",
			contract_tx_hash: "tx_reject_1",
		})

		;(pool.query as jest.Mock).mockImplementation(
			(sql: string, params?: unknown[]) => {
				if (String(sql).includes("milestone_audit_log")) {
					const ids = (params?.[0] as number[]) ?? []
					const rows: Array<{
						report_id: number
						decided_at: string
						contract_tx_hash: string | null
					}> = []
					if (ids.includes(approvedReport.id)) {
						rows.push({
							report_id: approvedReport.id,
							decided_at: new Date().toISOString(),
							contract_tx_hash: "abc123",
						})
					}
					if (ids.includes(rejectedReport.id)) {
						rows.push({
							report_id: rejectedReport.id,
							decided_at: new Date().toISOString(),
							contract_tx_hash: "tx_reject_1",
						})
					}
					return Promise.resolve({ rows })
				}
				return Promise.resolve({ rows: [] })
			},
		)

		const app = buildApp()
		const res = await request(app).get("/api/scholars/GSCHOLAR1/milestones")

		expect(res.status).toBe(200)
		expect(res.body.milestones).toHaveLength(3)

		const approved = res.body.milestones.find((m: any) => m.milestone_id === 2)
		expect(approved).toMatchObject({
			id: String(approvedReport.id),
			course_id: "stellar-basics",
			milestone_id: 2,
			status: "verified",
			evidence_url: "https://example.com/evidence",
			tx_hash: "abc123",
		})
		expect(typeof approved.submitted_at).toBe("string")
		expect(typeof approved.verified_at).toBe("string")

		const pending = res.body.milestones.find((m: any) => m.milestone_id === 3)
		expect(pending.status).toBe("pending")
		expect(pending.verified_at).toBeNull()
		expect(pending.tx_hash).toBeNull()
	})

	it("filters by status and course_id", async () => {
		const report1 = await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 1,
			evidence_github: "https://example.com/1",
			evidence_ipfs_cid: null,
			evidence_description: null,
		})
		await inMemoryMilestoneStore.updateReportStatus(report1.id, "approved")
		await inMemoryMilestoneStore.addAuditEntry({
			report_id: report1.id,
			validator_address: "GADMIN123",
			decision: "approved",
			rejection_reason: null,
			contract_tx_hash: "tx1",
		})

		await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GSCHOLAR1",
			course_id: "soroban-fundamentals",
			milestone_id: 1,
			evidence_github: "https://example.com/2",
			evidence_ipfs_cid: null,
			evidence_description: null,
		})

		;(pool.query as jest.Mock).mockImplementation(
			(sql: string, params?: unknown[]) => {
				if (String(sql).includes("milestone_audit_log")) {
					const ids = (params?.[0] as number[]) ?? []
					if (ids.includes(report1.id)) {
						return Promise.resolve({
							rows: [
								{
									report_id: report1.id,
									decided_at: new Date().toISOString(),
									contract_tx_hash: "tx1",
								},
							],
						})
					}
					return Promise.resolve({ rows: [] })
				}
				return Promise.resolve({ rows: [] })
			},
		)

		const app = buildApp()
		const res = await request(app).get(
			"/api/scholars/GSCHOLAR1/milestones?status=verified&course_id=stellar-basics",
		)

		expect(res.status).toBe(200)
		expect(res.body.milestones).toHaveLength(1)
		expect(res.body.milestones[0].status).toBe("verified")
		expect(res.body.milestones[0].course_id).toBe("stellar-basics")
	})

	it("returns 400 for invalid status", async () => {
		const app = buildApp()
		const res = await request(app).get(
			"/api/scholars/GSCHOLAR1/milestones?status=not-a-status",
		)

		expect(res.status).toBe(400)
		expect(res.body.error).toBe("Validation failed")
	})
})
