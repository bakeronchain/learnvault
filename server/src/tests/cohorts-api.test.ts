jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
		connect: jest.fn(),
	},
}))

import express from "express"
import request from "supertest"
import { pool } from "../db/index"
import { errorHandler } from "../middleware/error.middleware"
import { createCohortsRouter } from "../routes/cohorts.routes"
import { type JwtService } from "../services/jwt.service"

const mockedQuery = pool.query as jest.Mock
const mockedConnect = pool.connect as jest.Mock

const mockJwtService: JwtService = {
	signWalletToken: () => "mock-token",
	signRefreshToken: () => "mock-refresh-token",
	issueTokenPair: () => ({
		accessToken: "mock-token",
		refreshToken: "mock-refresh-token",
	}),
	verifyWalletToken: async () => ({ sub: "mock-address", jti: "mock-jti" }),
	verifyRefreshToken: async () => ({ sub: "mock-address", jti: "mock-jti" }),
	rotateRefreshToken: async () => ({
		accessToken: "mock-token",
		refreshToken: "mock-refresh-token",
		sub: "mock-address",
	}),
	revokeToken: async () => {},
}

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use("/api", createCohortsRouter(mockJwtService))
	app.use(errorHandler)
	return app
}

function mockClient() {
	const client = {
		query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
		release: jest.fn(),
	}
	mockedConnect.mockResolvedValue(client)
	return client
}

const auth = { Authorization: "Bearer mock-token" }

beforeEach(() => {
	mockedQuery.mockReset()
	mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 })
	mockedConnect.mockReset()
})

describe("POST /api/cohorts", () => {
	it("returns 401 without auth", async () => {
		const res = await request(buildApp()).post("/api/cohorts").send({
			name: "Squad A",
			course_slug: "stellar-basics",
			start_date: "2026-08-01",
		})

		expect(res.status).toBe(401)
	})

	it("returns 400 when required fields are missing", async () => {
		const res = await request(buildApp())
			.post("/api/cohorts")
			.set(auth)
			.send({ name: "Squad A" })

		expect(res.status).toBe(400)
	})

	it("returns 400 for an invalid start_date", async () => {
		const res = await request(buildApp()).post("/api/cohorts").set(auth).send({
			name: "Squad A",
			course_slug: "stellar-basics",
			start_date: "next tuesday",
		})

		expect(res.status).toBe(400)
	})

	it("returns 404 when the course does not exist", async () => {
		mockedQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })

		const res = await request(buildApp()).post("/api/cohorts").set(auth).send({
			name: "Squad A",
			course_slug: "no-such-course",
			start_date: "2026-08-01",
		})

		expect(res.status).toBe(404)
		expect(res.body.error).toBe("Course not found")
	})

	it("creates a cohort and auto-joins the creator", async () => {
		mockedQuery.mockResolvedValueOnce({
			rows: [{ slug: "stellar-basics" }],
			rowCount: 1,
		})
		const client = mockClient()
		client.query.mockImplementation((sql: string) => {
			if (sql.includes("INSERT INTO cohorts")) {
				return Promise.resolve({
					rows: [
						{
							id: 7,
							name: "Squad A",
							course_slug: "stellar-basics",
							start_date: "2026-08-01",
							max_members: 8,
							created_by: "mock-address",
							created_at: "2026-07-17T00:00:00Z",
						},
					],
					rowCount: 1,
				})
			}
			return Promise.resolve({ rows: [], rowCount: 0 })
		})

		const res = await request(buildApp()).post("/api/cohorts").set(auth).send({
			name: "Squad A",
			course_slug: "stellar-basics",
			start_date: "2026-08-01",
		})

		expect(res.status).toBe(201)
		expect(res.body.id).toBe(7)
		expect(res.body.member_count).toBe(1)

		const memberInsert = client.query.mock.calls.find(([sql]) =>
			String(sql).includes("INSERT INTO cohort_members"),
		)
		expect(memberInsert).toBeDefined()
		expect(memberInsert?.[1]).toEqual([7, "mock-address"])
		expect(client.query).toHaveBeenCalledWith("COMMIT")
	})
})

describe("GET /api/cohorts", () => {
	it("lists cohorts for a course with member counts", async () => {
		mockedQuery.mockResolvedValueOnce({
			rows: [
				{
					id: 7,
					name: "Squad A",
					course_slug: "stellar-basics",
					start_date: "2026-08-01",
					max_members: 8,
					created_by: "GABC",
					created_at: "2026-07-17T00:00:00Z",
					member_count: 3,
				},
			],
			rowCount: 1,
		})

		const res = await request(buildApp()).get(
			"/api/cohorts?course=stellar-basics",
		)

		expect(res.status).toBe(200)
		expect(res.body.data).toHaveLength(1)
		expect(res.body.data[0].member_count).toBe(3)
		expect(mockedQuery.mock.calls[0][1]).toEqual(["stellar-basics"])
	})
})

describe("POST /api/cohorts/:id/join", () => {
	it("returns 404 for an unknown cohort", async () => {
		mockClient()

		const res = await request(buildApp()).post("/api/cohorts/99/join").set(auth)

		expect(res.status).toBe(404)
	})

	it("rejects joining a full cohort with 409", async () => {
		const client = mockClient()
		client.query.mockImplementation((sql: string) => {
			if (String(sql).includes("FROM cohorts")) {
				return Promise.resolve({
					rows: [{ id: 7, max_members: 2 }],
					rowCount: 1,
				})
			}
			if (String(sql).includes("FROM cohort_members")) {
				return Promise.resolve({
					rows: [{ learner_addr: "GAAA" }, { learner_addr: "GBBB" }],
					rowCount: 2,
				})
			}
			return Promise.resolve({ rows: [], rowCount: 0 })
		})

		const res = await request(buildApp()).post("/api/cohorts/7/join").set(auth)

		expect(res.status).toBe(409)
		expect(res.body.error).toBe("Cohort is full")

		const memberInsert = client.query.mock.calls.find(([sql]) =>
			String(sql).includes("INSERT INTO cohort_members"),
		)
		expect(memberInsert).toBeUndefined()
	})

	it("joins successfully when there is capacity", async () => {
		const client = mockClient()
		client.query.mockImplementation((sql: string) => {
			if (String(sql).includes("FROM cohorts")) {
				return Promise.resolve({
					rows: [{ id: 7, max_members: 8 }],
					rowCount: 1,
				})
			}
			if (String(sql).includes("FROM cohort_members")) {
				return Promise.resolve({
					rows: [{ learner_addr: "GAAA" }],
					rowCount: 1,
				})
			}
			return Promise.resolve({ rows: [], rowCount: 0 })
		})

		const res = await request(buildApp()).post("/api/cohorts/7/join").set(auth)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			joined: true,
			already_member: false,
			member_count: 2,
		})
		expect(client.query).toHaveBeenCalledWith("COMMIT")
	})

	it("is idempotent when already a member", async () => {
		const client = mockClient()
		client.query.mockImplementation((sql: string) => {
			if (String(sql).includes("FROM cohorts")) {
				return Promise.resolve({
					rows: [{ id: 7, max_members: 2 }],
					rowCount: 1,
				})
			}
			if (String(sql).includes("FROM cohort_members")) {
				// Cohort is full, but the caller is one of the members
				return Promise.resolve({
					rows: [{ learner_addr: "mock-address" }, { learner_addr: "GBBB" }],
					rowCount: 2,
				})
			}
			return Promise.resolve({ rows: [], rowCount: 0 })
		})

		const res = await request(buildApp()).post("/api/cohorts/7/join").set(auth)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({ joined: true, already_member: true })

		const memberInsert = client.query.mock.calls.find(([sql]) =>
			String(sql).includes("INSERT INTO cohort_members"),
		)
		expect(memberInsert).toBeUndefined()
	})
})

describe("POST /api/cohorts/:id/leave", () => {
	it("returns 404 for an unknown cohort", async () => {
		mockedQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })

		const res = await request(buildApp())
			.post("/api/cohorts/99/leave")
			.set(auth)

		expect(res.status).toBe(404)
	})

	it("removes membership when the caller is a member", async () => {
		mockedQuery
			.mockResolvedValueOnce({ rows: [{ id: 7 }], rowCount: 1 })
			.mockResolvedValueOnce({ rows: [], rowCount: 1 })

		const res = await request(buildApp()).post("/api/cohorts/7/leave").set(auth)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({ left: true, was_member: true })
	})

	it("is idempotent when the caller is not a member", async () => {
		mockedQuery
			.mockResolvedValueOnce({ rows: [{ id: 7 }], rowCount: 1 })
			.mockResolvedValueOnce({ rows: [], rowCount: 0 })

		const res = await request(buildApp()).post("/api/cohorts/7/leave").set(auth)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({ left: true, was_member: false })
	})
})

describe("GET /api/cohorts/:id", () => {
	it("returns 404 for an unknown cohort", async () => {
		mockedQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })

		const res = await request(buildApp()).get("/api/cohorts/99")

		expect(res.status).toBe(404)
	})

	it("returns members with progress and aggregates group completion", async () => {
		mockedQuery
			// 1. cohort lookup
			.mockResolvedValueOnce({
				rows: [
					{
						id: 7,
						name: "Squad A",
						course_slug: "stellar-basics",
						start_date: "2026-08-01",
						max_members: 8,
						created_by: "GAAA",
						created_at: "2026-07-17T00:00:00Z",
					},
				],
				rowCount: 1,
			})
			// 2. course totals: 5 milestones
			.mockResolvedValueOnce({
				rows: [{ milestone_count: 5, lesson_count: 10 }],
				rowCount: 1,
			})
			// 3. members with per-member approved milestone counts
			.mockResolvedValueOnce({
				rows: [
					{
						learner_addr: "GAAA",
						joined_at: "2026-07-17T00:00:00Z",
						milestones_completed: 5,
					},
					{
						learner_addr: "GBBB",
						joined_at: "2026-07-17T01:00:00Z",
						milestones_completed: 3,
					},
					{
						learner_addr: "GCCC",
						joined_at: "2026-07-17T02:00:00Z",
						milestones_completed: 0,
					},
				],
				rowCount: 3,
			})

		const res = await request(buildApp()).get("/api/cohorts/7")

		expect(res.status).toBe(200)
		expect(res.body.member_count).toBe(3)
		expect(res.body.total_milestones).toBe(5)
		// (5 + 3 + 0) / (3 members * 5 milestones) = 53.33% -> 53
		expect(res.body.group_completion_pct).toBe(53)
		expect(res.body.members[0]).toMatchObject({
			learner_addr: "GAAA",
			milestones_completed: 5,
			total_milestones: 5,
		})
	})

	it("falls back to lesson count when a course has no milestone rows", async () => {
		mockedQuery
			.mockResolvedValueOnce({
				rows: [
					{
						id: 7,
						name: "Squad A",
						course_slug: "stellar-basics",
						start_date: "2026-08-01",
						max_members: 8,
						created_by: "GAAA",
						created_at: "2026-07-17T00:00:00Z",
					},
				],
				rowCount: 1,
			})
			.mockResolvedValueOnce({
				rows: [{ milestone_count: 0, lesson_count: 4 }],
				rowCount: 1,
			})
			.mockResolvedValueOnce({
				rows: [
					{
						learner_addr: "GAAA",
						joined_at: "2026-07-17T00:00:00Z",
						milestones_completed: 2,
					},
				],
				rowCount: 1,
			})

		const res = await request(buildApp()).get("/api/cohorts/7")

		expect(res.status).toBe(200)
		expect(res.body.total_milestones).toBe(4)
		expect(res.body.group_completion_pct).toBe(50)
	})
})
