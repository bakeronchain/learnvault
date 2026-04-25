/**
 * Peer review API — uses in-memory milestone + peer stores (mock pool).
 */

jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn(),
		connect: jest.fn(),
	},
}))

import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { inMemoryMilestoneStore } from "../db/milestone-store"
import { resetPeerReviewMemoryForTests } from "../db/peer-review-store"
import { errorHandler } from "../middleware/error.middleware"
import { createPeerReviewRouter } from "../routes/peer-review.routes"

const JWT_SECRET = "learnvault-secret"

const testJwtService = {
	signWalletToken: (addr: string) => jwt.sign({ sub: addr }, JWT_SECRET),
	verifyWalletToken: async (token: string) => {
		const d = jwt.verify(token, JWT_SECRET) as {
			sub?: string
			address?: string
		}
		const sub = d.sub ?? d.address ?? ""
		if (!sub) throw new Error("Invalid token")
		return { sub }
	},
	revokeToken: async () => {},
}

function makeWalletToken(address = "GREVIEWER1") {
	return jwt.sign({ address }, JWT_SECRET, { expiresIn: "1h" })
}

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use("/api", createPeerReviewRouter(testJwtService))
	app.use(errorHandler)
	return app
}

beforeEach(() => {
	jest.clearAllMocks()
	inMemoryMilestoneStore["reports"] = []
	inMemoryMilestoneStore["auditLog"] = []
	inMemoryMilestoneStore["reportSeq"] = 1
	inMemoryMilestoneStore["auditSeq"] = 1
	resetPeerReviewMemoryForTests()
})

describe("GET /api/peer-review/queue", () => {
	it("returns 401 without token", async () => {
		const res = await request(buildApp()).get("/api/peer-review/queue")
		expect(res.status).toBe(401)
	})

	it("lists pending milestones the reviewer can peer-review", async () => {
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
			.get("/api/peer-review/queue")
			.set("Authorization", `Bearer ${makeWalletToken("GREVIEWER1")}`)

		expect(res.status).toBe(200)
		expect(res.body.data).toHaveLength(1)
		expect(res.body.data[0].scholar_address).toBe("GSCHOLAR1")
		expect(res.body.data[0].peer_approval_count).toBe(0)
		expect(res.body.data[0].peer_rejection_count).toBe(0)
	})

	it("excludes the scholar's own pending submissions", async () => {
		await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GREVIEWER1",
			course_id: "stellar-basics",
			milestone_id: 1,
			evidence_description: "Mine",
			evidence_github: null,
			evidence_ipfs_cid: null,
		})

		const app = buildApp()
		const res = await request(app)
			.get("/api/peer-review/queue")
			.set("Authorization", `Bearer ${makeWalletToken("GREVIEWER1")}`)

		expect(res.status).toBe(200)
		expect(res.body.data).toHaveLength(0)
	})
})

describe("POST /api/peer-review/reports/:id", () => {
	it("submits a peer review and returns LRN reward metadata", async () => {
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
			.post(`/api/peer-review/reports/${report.id}`)
			.set("Authorization", `Bearer ${makeWalletToken("GREVIEWER1")}`)
			.send({ verdict: "approve", comment: "Looks good" })

		expect(res.status).toBe(201)
		expect(res.body.data.report_id).toBe(report.id)
		expect(res.body.data.verdict).toBe("approve")
		expect(res.body.data.lrn_awarded).toBeDefined()
	})

	it("returns 403 when reviewing own submission", async () => {
		const report = await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GREVIEWER1",
			course_id: "stellar-basics",
			milestone_id: 1,
			evidence_description: "Mine",
			evidence_github: null,
			evidence_ipfs_cid: null,
		})

		const app = buildApp()
		const res = await request(app)
			.post(`/api/peer-review/reports/${report.id}`)
			.set("Authorization", `Bearer ${makeWalletToken("GREVIEWER1")}`)
			.send({ verdict: "approve" })

		expect(res.status).toBe(403)
		expect(res.body.code).toBe("SELF_REVIEW")
	})

	it("returns 409 on duplicate peer review", async () => {
		const report = await inMemoryMilestoneStore["createReport"]({
			scholar_address: "GSCHOLAR1",
			course_id: "stellar-basics",
			milestone_id: 1,
			evidence_description: "Done",
			evidence_github: null,
			evidence_ipfs_cid: null,
		})

		const app = buildApp()
		const token = makeWalletToken("GREVIEWER1")
		await request(app)
			.post(`/api/peer-review/reports/${report.id}`)
			.set("Authorization", `Bearer ${token}`)
			.send({ verdict: "approve" })

		const res = await request(app)
			.post(`/api/peer-review/reports/${report.id}`)
			.set("Authorization", `Bearer ${token}`)
			.send({ verdict: "reject" })

		expect(res.status).toBe(409)
		expect(res.body.code).toBe("ALREADY_REVIEWED")
	})
})
