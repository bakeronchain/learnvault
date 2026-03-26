jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn(),
	},
}))

import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { pool } from "../db/index"
import { errorHandler } from "../middleware/error.middleware"
import { coursesRouter } from "../routes/courses.routes"

const mockedQuery = pool.query as jest.Mock
const JWT_SECRET = "learnvault-secret"

const adminToken = jwt.sign({ sub: "GADMIN", role: "admin" }, JWT_SECRET, {
	expiresIn: "1h",
})
const nonAdminToken = jwt.sign({ sub: "GUSER" }, JWT_SECRET, {
	expiresIn: "1h",
})

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use("/api", coursesRouter)
	app.use(errorHandler)
	return app
}

beforeEach(() => {
	mockedQuery.mockReset()
	delete process.env.ADMIN_API_KEY
})

describe("GET /api/courses", () => {
	it("returns published courses only with pagination payload", async () => {
		mockedQuery
			.mockResolvedValueOnce({ rows: [{ count: "1" }] })
			.mockResolvedValueOnce({
				rows: [
					{
						id: 1,
						slug: "stellar-basics",
						title: "Stellar Basics",
						description: "Basics",
						cover_image_url: null,
						track: "web3",
						difficulty: "beginner",
						published_at: "2026-01-01T00:00:00.000Z",
						created_at: "2026-01-01T00:00:00.000Z",
						updated_at: "2026-01-02T00:00:00.000Z",
					},
				],
			})

		const res = await request(buildApp()).get("/api/courses")
		expect(res.status).toBe(200)
		expect(res.body.total).toBe(1)
		expect(res.body.totalPages).toBe(1)
		expect(res.body.data).toHaveLength(1)
		expect(res.body.data[0].published).toBe(true)
	})

	it("applies track and difficulty filters together", async () => {
		mockedQuery
			.mockResolvedValueOnce({ rows: [{ count: "0" }] })
			.mockResolvedValueOnce({
				rows: [],
			})

		const res = await request(buildApp()).get(
			"/api/courses?track=web3&difficulty=beginner",
		)
		expect(res.status).toBe(200)
		expect(res.body.data).toEqual([])
		expect(res.body.total).toBe(0)
	})

	it("enforces max limit and computes pages", async () => {
		mockedQuery
			.mockResolvedValueOnce({ rows: [{ count: "120" }] })
			.mockResolvedValueOnce({
				rows: [],
			})

		const res = await request(buildApp()).get("/api/courses?page=2&limit=999")
		expect(res.status).toBe(200)
		expect(res.body.limit).toBe(50)
		expect(res.body.page).toBe(2)
		expect(res.body.totalPages).toBe(3)
	})

	it("returns empty results for invalid difficulty", async () => {
		const res = await request(buildApp()).get("/api/courses?difficulty=expert")
		expect(res.status).toBe(200)
		expect(res.body).toEqual({
			data: [],
			page: 1,
			limit: 12,
			total: 0,
			totalPages: 0,
		})
	})
})

describe("GET /api/courses/:slug", () => {
	it("returns a course with nested lessons", async () => {
		mockedQuery
			.mockResolvedValueOnce({
				rows: [
					{
						id: 1,
						slug: "stellar-basics",
						title: "Stellar Basics",
						description: "Basics",
						cover_image_url: null,
						track: "web3",
						difficulty: "beginner",
						published_at: "2026-01-01T00:00:00.000Z",
						created_at: "2026-01-01T00:00:00.000Z",
						updated_at: "2026-01-02T00:00:00.000Z",
					},
				],
			})
			.mockResolvedValueOnce({
				rows: [
					{
						id: 10,
						course_id: 1,
						title: "Lesson 1",
						content_markdown: "Content",
						order_index: 1,
						quiz: [],
						created_at: "2026-01-01T00:00:00.000Z",
						updated_at: "2026-01-01T00:00:00.000Z",
					},
				],
			})

		const res = await request(buildApp()).get("/api/courses/stellar-basics")
		expect(res.status).toBe(200)
		expect(res.body.slug).toBe("stellar-basics")
		expect(res.body.lessons).toHaveLength(1)
	})

	it("returns 404 when course is missing", async () => {
		mockedQuery.mockResolvedValueOnce({ rows: [] })
		const res = await request(buildApp()).get("/api/courses/missing-course")
		expect(res.status).toBe(404)
		expect(res.body).toEqual({ error: "Course not found" })
	})
})

describe("GET /api/courses/:slug/lessons/:id", () => {
	it("returns lesson including quiz", async () => {
		mockedQuery.mockResolvedValueOnce({
			rows: [
				{
					id: 10,
					course_id: 1,
					title: "Lesson 1",
					content_markdown: "Content",
					order_index: 1,
					quiz: [{ question: "Q?", options: ["A", "B"], correctIndex: 0 }],
					created_at: "2026-01-01T00:00:00.000Z",
					updated_at: "2026-01-01T00:00:00.000Z",
				},
			],
		})

		const res = await request(buildApp()).get(
			"/api/courses/stellar-basics/lessons/10",
		)
		expect(res.status).toBe(200)
		expect(res.body.id).toBe(10)
		expect(res.body.quiz).toHaveLength(1)
	})

	it("returns 404 for wrong course or missing lesson", async () => {
		mockedQuery.mockResolvedValueOnce({ rows: [] })
		const res = await request(buildApp()).get("/api/courses/defi/lessons/10")
		expect(res.status).toBe(404)
		expect(res.body).toEqual({ error: "Lesson not found" })
	})
})

describe("POST /api/courses", () => {
	it("creates a course for admin", async () => {
		mockedQuery.mockResolvedValueOnce({
			rows: [
				{
					id: 11,
					slug: "new-course",
					title: "New Course",
					description: "",
					cover_image_url: null,
					track: "web3",
					difficulty: "beginner",
					published_at: null,
					created_at: "2026-01-01T00:00:00.000Z",
					updated_at: "2026-01-01T00:00:00.000Z",
				},
			],
		})

		const res = await request(buildApp())
			.post("/api/courses")
			.set("Authorization", `Bearer ${adminToken}`)
			.send({
				title: "New Course",
				slug: "new-course",
				track: "web3",
				difficulty: "beginner",
			})

		expect(res.status).toBe(201)
		expect(res.body.slug).toBe("new-course")
		expect(res.body.published).toBe(false)
	})

	it("returns 400 for missing required fields", async () => {
		const res = await request(buildApp())
			.post("/api/courses")
			.set("Authorization", `Bearer ${adminToken}`)
			.send({ slug: "only-slug" })

		expect(res.status).toBe(400)
		expect(res.body.field).toBe("title")
	})

	it("returns 409 for duplicate slug", async () => {
		mockedQuery.mockRejectedValueOnce({ code: "23505" })
		const res = await request(buildApp())
			.post("/api/courses")
			.set("Authorization", `Bearer ${adminToken}`)
			.send({
				title: "Duplicate",
				slug: "duplicate",
				track: "web3",
				difficulty: "beginner",
			})
		expect(res.status).toBe(409)
	})

	it("returns 401 without auth", async () => {
		const res = await request(buildApp()).post("/api/courses").send({})
		expect(res.status).toBe(401)
		expect(res.body).toEqual({ error: "Unauthorized" })
	})

	it("returns 403 for non-admin JWT", async () => {
		const res = await request(buildApp())
			.post("/api/courses")
			.set("Authorization", `Bearer ${nonAdminToken}`)
			.send({})
		expect(res.status).toBe(403)
		expect(res.body).toEqual({ error: "Forbidden" })
	})
})

describe("PUT /api/courses/:id", () => {
	it("updates course fields", async () => {
		mockedQuery
			.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] })
			.mockResolvedValueOnce({
				rows: [
					{
						id: 1,
						slug: "stellar-basics",
						title: "Updated Title",
						description: "Desc",
						cover_image_url: null,
						track: "web3",
						difficulty: "beginner",
						published_at: null,
						created_at: "2026-01-01T00:00:00.000Z",
						updated_at: "2026-01-03T00:00:00.000Z",
					},
				],
			})

		const res = await request(buildApp())
			.put("/api/courses/1")
			.set("Authorization", `Bearer ${adminToken}`)
			.send({ title: "Updated Title" })

		expect(res.status).toBe(200)
		expect(res.body.title).toBe("Updated Title")
	})

	it("returns 404 when course does not exist", async () => {
		mockedQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })
		const res = await request(buildApp())
			.put("/api/courses/999")
			.set("Authorization", `Bearer ${adminToken}`)
			.send({ title: "Nope" })
		expect(res.status).toBe(404)
	})

	it("returns 401 without auth", async () => {
		const res = await request(buildApp()).put("/api/courses/1").send({})
		expect(res.status).toBe(401)
	})

	it("returns 409 for duplicate slug", async () => {
		mockedQuery
			.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] })
			.mockRejectedValueOnce({ code: "23505" })

		const res = await request(buildApp())
			.put("/api/courses/1")
			.set("Authorization", `Bearer ${adminToken}`)
			.send({ slug: "taken-slug" })
		expect(res.status).toBe(409)
		expect(res.body).toEqual({ error: "Slug already exists" })
	})
})
