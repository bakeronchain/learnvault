jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
		connect: jest.fn().mockResolvedValue({
			query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
			release: jest.fn(),
		}),
	},
}))

import express from "express"
import request from "supertest"
import { pool } from "../db/index"
import { enrollmentsRouter } from "../routes/enrollments.routes"
import { errorHandler } from "../middleware/error.middleware"

const mockedQuery = pool.query as jest.Mock

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use("/api", enrollmentsRouter)
	app.use(errorHandler)
	return app
}

beforeEach(() => {
	mockedQuery.mockReset()
})

describe("POST /api/enrollments", () => {
	it("returns 400 when missing required fields", async () => {
		const res = await request(buildApp())
			.post("/api/enrollments")
			.send({ learner_address: "GABC" })

		expect(res.status).toBe(400)
	})

	it("returns 409 when already enrolled", async () => {
		mockedQuery.mockResolvedValueOnce({
			rows: [{ id: 1 }],
			rowCount: 1,
		})

		const res = await request(buildApp())
			.post("/api/enrollments")
			.send({
				learner_address: "GABC",
				course_id: "stellar-basics",
				tx_hash: "hash123",
			})

		expect(res.status).toBe(409)
		expect(res.body.error).toBe("Already enrolled in this course")
	})

	it("returns 409 with unmet prerequisites details when not completed", async () => {
		mockedQuery
			// 1. check if already enrolled -> empty
			.mockResolvedValueOnce({ rows: [], rowCount: 0 })
			// 2. select course prerequisites -> has course with prereq ID [2]
			.mockResolvedValueOnce({
				rows: [{ id: 1, slug: "stellar-basics", title: "Stellar Basics", prerequisites: [2] }],
				rowCount: 1,
			})
			// 3. select details of prerequisite 2
			.mockResolvedValueOnce({
				rows: [{ id: 2, slug: "soroban-fundamentals", title: "Soroban Fundamentals" }],
				rowCount: 1,
			})
			// 4. select completed non-revoked credentials -> empty (learner has not completed it)
			.mockResolvedValueOnce({
				rows: [],
				rowCount: 0,
			})

		const res = await request(buildApp())
			.post("/api/enrollments")
			.send({
				learner_address: "GABC",
				course_id: "stellar-basics",
				tx_hash: "hash123",
			})

		expect(res.status).toBe(409)
		expect(res.body.error).toBe("Prerequisites not met")
		expect(res.body.unmetPrerequisites).toEqual([
			{ id: 2, slug: "soroban-fundamentals", title: "Soroban Fundamentals" },
		])
	})

	it("enrolls successfully when prerequisites are met", async () => {
		mockedQuery
			// 1. check if already enrolled -> empty
			.mockResolvedValueOnce({ rows: [], rowCount: 0 })
			// 2. select course prerequisites -> has course with prereq ID [2]
			.mockResolvedValueOnce({
				rows: [{ id: 1, slug: "stellar-basics", title: "Stellar Basics", prerequisites: [2] }],
				rowCount: 1,
			})
			// 3. select details of prerequisite 2
			.mockResolvedValueOnce({
				rows: [{ id: 2, slug: "soroban-fundamentals", title: "Soroban Fundamentals" }],
				rowCount: 1,
			})
			// 4. select completed credentials -> returns "soroban-fundamentals" as completed
			.mockResolvedValueOnce({
				rows: [{ course_id: "soroban-fundamentals" }],
				rowCount: 1,
			})
			// 5. get content version -> version 1
			.mockResolvedValueOnce({
				rows: [{ content_version: 1 }],
				rowCount: 1,
			})
			// 6. insert enrollment -> returns enrollment info
			.mockResolvedValueOnce({
				rows: [{ id: 100, enrolled_at: "2026-01-01T00:00:00Z", content_version: 1 }],
				rowCount: 1,
			})

		const res = await request(buildApp())
			.post("/api/enrollments")
			.send({
				learner_address: "GABC",
				course_id: "stellar-basics",
				tx_hash: "hash123",
			})

		expect(res.status).toBe(201)
		expect(res.body.enrollment_id).toBe(100)
	})
})
