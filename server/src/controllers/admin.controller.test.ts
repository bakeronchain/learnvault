jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn(),
	},
}))

import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"

import { errorHandler } from "../middleware/error.middleware"
import { adminRouter } from "../routes/admin.routes"
import { pool } from "../db/index"

const JWT_SECRET = "learnvault-secret"
const queryMock = pool.query as jest.Mock

function makeAdminToken(address = "GADMIN123") {
	return jwt.sign({ address }, JWT_SECRET, { expiresIn: "1h" })
}

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use("/api", adminRouter)
	app.use(errorHandler)
	return app
}

beforeEach(() => {
	jest.clearAllMocks()
	process.env.JWT_SECRET = JWT_SECRET
	delete process.env.ADMIN_ADDRESSES
	delete process.env.JWT_PUBLIC_KEY
	delete process.env.JWT_PRIVATE_KEY
	delete process.env.VALIDATOR_REVIEW_QUEUE_THRESHOLD
})

afterEach(() => {
	delete process.env.VALIDATOR_REVIEW_QUEUE_THRESHOLD
})

describe("GET /api/admin/validators/analytics", () => {
	it("returns 401 when auth token is missing", async () => {
		const res = await request(buildApp()).get("/api/admin/validators/analytics")

		expect(res.status).toBe(401)
		expect(queryMock).not.toHaveBeenCalled()
	})

	it("returns per-validator analytics and review queue payload", async () => {
		queryMock
			.mockResolvedValueOnce({
				rows: [
					{
						validator_address: "GVAL123",
						milestones_reviewed: "3",
						average_review_time_seconds: "142.5",
						approval_rate: "66.6667",
						appeal_reversal_rate: "33.3333",
					},
				],
			})
			.mockResolvedValueOnce({ rows: [{ pending_reviews: "12" }] })

		const res = await request(buildApp())
			.get("/api/admin/validators/analytics")
			.set("Authorization", `Bearer ${makeAdminToken()}`)

		expect(res.status).toBe(200)
		expect(res.body.validators).toEqual([
			{
				validator_address: "GVAL123",
				milestones_reviewed: 3,
				average_review_time_seconds: 142.5,
				approval_rate: 66.6667,
				appeal_reversal_rate: 33.3333,
			},
		])
		expect(res.body.review_queue).toEqual({
			pending_reviews: 12,
			threshold: 25,
			exceeded: false,
		})
	})

	it("marks queue alert as exceeded when pending reviews pass threshold", async () => {
		process.env.VALIDATOR_REVIEW_QUEUE_THRESHOLD = "5"
		queryMock.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
			rows: [{ pending_reviews: 9 }],
		})

		const res = await request(buildApp())
			.get("/api/admin/validators/analytics")
			.set("Authorization", `Bearer ${makeAdminToken()}`)

		expect(res.status).toBe(200)
		expect(res.body.validators).toEqual([])
		expect(res.body.review_queue).toEqual({
			pending_reviews: 9,
			threshold: 5,
			exceeded: true,
		})
	})

	it("falls back to default threshold when env value is invalid", async () => {
		process.env.VALIDATOR_REVIEW_QUEUE_THRESHOLD = "invalid"
		queryMock.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
			rows: [{ pending_reviews: 2 }],
		})

		const res = await request(buildApp())
			.get("/api/admin/validators/analytics")
			.set("Authorization", `Bearer ${makeAdminToken()}`)

		expect(res.status).toBe(200)
		expect(res.body.review_queue.threshold).toBe(25)
	})

	it("returns 500 when analytics query fails", async () => {
		queryMock.mockRejectedValueOnce(new Error("db down"))

		const res = await request(buildApp())
			.get("/api/admin/validators/analytics")
			.set("Authorization", `Bearer ${makeAdminToken()}`)

		expect(res.status).toBe(500)
		expect(res.body.error).toBe("Failed to fetch validator analytics")
	})
})
