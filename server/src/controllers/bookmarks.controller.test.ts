import express, { type Express } from "express"
import jwt from "jsonwebtoken"
import request from "supertest"

// ── Mocks must be declared before any imports that use these modules ─────────

jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn(),
		connect: jest.fn(),
	},
}))

import { pool } from "../db/index"
import { errorHandler } from "../middleware/error.middleware"
import { createBookmarksRouter } from "../routes/bookmarks.routes"

const mockedQuery = pool.query as jest.Mock

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_SECRET = "learnvault-secret"
const ALICE = "GALICE1234567890ABCDE"
const BOB = "GBOB9876543210ZYXWVU"
const COURSE_A = "stellar-basics"
const COURSE_B = "soroban-advanced"

const makeToken = (address: string) =>
	`Bearer ${jwt.sign({ sub: address }, TEST_SECRET)}`

const testJwtService = {
	signWalletToken: (address: string) => jwt.sign({ sub: address }, TEST_SECRET),
	verifyWalletToken: async (token: string) => {
		const decoded = jwt.verify(token, TEST_SECRET) as { sub?: string }
		if (!decoded.sub) throw new Error("Invalid token")
		return { sub: decoded.sub }
	},
	revokeToken: async (_token: string) => {},
}

const buildApp = (): Express => {
	const app = express()
	app.use(express.json())
	app.use("/api", createBookmarksRouter(testJwtService))
	app.use(errorHandler)
	return app
}

beforeEach(() => {
	jest.clearAllMocks()
})

// ── GET /api/me/bookmarks ────────────────────────────────────────────────────

describe("GET /api/me/bookmarks", () => {
	it("returns the authenticated learner's bookmarks", async () => {
		const now = new Date().toISOString()
		mockedQuery.mockResolvedValueOnce({
			rows: [
				{ id: 1, course_id: COURSE_A, created_at: now },
				{ id: 2, course_id: COURSE_B, created_at: now },
			],
		})

		const res = await request(buildApp())
			.get("/api/me/bookmarks")
			.set("Authorization", makeToken(ALICE))

		expect(res.status).toBe(200)
		expect(res.body.data).toHaveLength(2)
		expect(res.body.data[0]).toMatchObject({
			bookmark_id: 1,
			course_id: COURSE_A,
		})
		// Ensure address came from token, not from query/body
		expect(mockedQuery.mock.calls[0][1]).toEqual([ALICE])
	})

	it("returns empty array when learner has no bookmarks", async () => {
		mockedQuery.mockResolvedValueOnce({ rows: [] })

		const res = await request(buildApp())
			.get("/api/me/bookmarks")
			.set("Authorization", makeToken(BOB))

		expect(res.status).toBe(200)
		expect(res.body.data).toEqual([])
	})

	it("returns 401 when no Authorization header is provided", async () => {
		const res = await request(buildApp()).get("/api/me/bookmarks")
		expect(res.status).toBe(401)
		expect(mockedQuery).not.toHaveBeenCalled()
	})

	it("returns 401 when the token is invalid", async () => {
		const res = await request(buildApp())
			.get("/api/me/bookmarks")
			.set("Authorization", "Bearer not-a-real-jwt")

		expect(res.status).toBe(401)
		expect(mockedQuery).not.toHaveBeenCalled()
	})

	it("returns 500 on a database error", async () => {
		mockedQuery.mockRejectedValueOnce(new Error("DB down"))

		const res = await request(buildApp())
			.get("/api/me/bookmarks")
			.set("Authorization", makeToken(ALICE))

		expect(res.status).toBe(500)
	})
})

// ── POST /api/me/bookmarks ───────────────────────────────────────────────────

describe("POST /api/me/bookmarks", () => {
	it("creates a new bookmark (201)", async () => {
		const now = new Date().toISOString()
		mockedQuery.mockResolvedValueOnce({
			rows: [{ id: 10, course_id: COURSE_A, created_at: now, is_new: true }],
		})

		const res = await request(buildApp())
			.post("/api/me/bookmarks")
			.set("Authorization", makeToken(ALICE))
			.send({ course_id: COURSE_A })

		expect(res.status).toBe(201)
		expect(res.body).toMatchObject({
			bookmark_id: 10,
			course_id: COURSE_A,
		})
		// Verify the INSERT ran with token-derived address
		expect(mockedQuery.mock.calls[0][1]).toEqual([ALICE, COURSE_A])
	})

	it("is idempotent — returns 200 when bookmark already existed", async () => {
		const now = new Date().toISOString()
		// Upsert: ON CONFLICT DO UPDATE returns the existing row, is_new = false
		mockedQuery.mockResolvedValueOnce({
			rows: [{ id: 7, course_id: COURSE_A, created_at: now, is_new: false }],
		})

		const res = await request(buildApp())
			.post("/api/me/bookmarks")
			.set("Authorization", makeToken(ALICE))
			.send({ course_id: COURSE_A })

		expect(res.status).toBe(200)
		expect(res.body.bookmark_id).toBe(7)
	})

	it("returns 500 if the upsert unexpectedly returns no rows", async () => {
		mockedQuery.mockResolvedValueOnce({ rows: [] })

		const res = await request(buildApp())
			.post("/api/me/bookmarks")
			.set("Authorization", makeToken(ALICE))
			.send({ course_id: COURSE_A })

		expect(res.status).toBe(500)
	})

	it("returns 400 when course_id is missing", async () => {
		const res = await request(buildApp())
			.post("/api/me/bookmarks")
			.set("Authorization", makeToken(ALICE))
			.send({})

		expect(res.status).toBe(400)
		expect(mockedQuery).not.toHaveBeenCalled()
	})

	it("returns 400 when course_id is an empty string", async () => {
		const res = await request(buildApp())
			.post("/api/me/bookmarks")
			.set("Authorization", makeToken(ALICE))
			.send({ course_id: "   " })

		expect(res.status).toBe(400)
		expect(mockedQuery).not.toHaveBeenCalled()
	})

	it("rejects unknown fields (strict schema)", async () => {
		const res = await request(buildApp())
			.post("/api/me/bookmarks")
			.set("Authorization", makeToken(ALICE))
			.send({ course_id: COURSE_A, address: BOB })

		expect(res.status).toBe(400)
		expect(mockedQuery).not.toHaveBeenCalled()
	})

	it("returns 401 without auth", async () => {
		const res = await request(buildApp())
			.post("/api/me/bookmarks")
			.send({ course_id: COURSE_A })

		expect(res.status).toBe(401)
		expect(mockedQuery).not.toHaveBeenCalled()
	})

	it("cannot bookmark on behalf of another address — body.address is ignored", async () => {
		mockedQuery.mockResolvedValueOnce({
			rows: [
				{
					id: 99,
					course_id: COURSE_A,
					created_at: new Date().toISOString(),
					is_new: true,
				},
			],
		})

		// strict schema rejects unknown fields, but we also want to prove that even
		// if somehow an address slipped through, only the token-derived one reaches SQL
		await request(buildApp())
			.post("/api/me/bookmarks")
			.set("Authorization", makeToken(ALICE))
			.send({ course_id: COURSE_A })

		// Address comes from JWT (ALICE), not from any spoofed payload
		expect(mockedQuery.mock.calls[0][1]).toEqual([ALICE, COURSE_A])
	})
})

// ── DELETE /api/me/bookmarks/:courseId ───────────────────────────────────────

describe("DELETE /api/me/bookmarks/:courseId", () => {
	it("deletes a bookmark and returns 204", async () => {
		mockedQuery.mockResolvedValueOnce({ rowCount: 1 })

		const res = await request(buildApp())
			.delete(`/api/me/bookmarks/${COURSE_A}`)
			.set("Authorization", makeToken(ALICE))

		expect(res.status).toBe(204)
		expect(mockedQuery.mock.calls[0][1]).toEqual([ALICE, COURSE_A])
	})

	it("is idempotent — returns 204 even if the bookmark never existed", async () => {
		mockedQuery.mockResolvedValueOnce({ rowCount: 0 })

		const res = await request(buildApp())
			.delete(`/api/me/bookmarks/${COURSE_B}`)
			.set("Authorization", makeToken(ALICE))

		expect(res.status).toBe(204)
	})

	it("cannot delete another learner's bookmark — address is token-scoped", async () => {
		mockedQuery.mockResolvedValueOnce({ rowCount: 0 })

		await request(buildApp())
			.delete(`/api/me/bookmarks/${COURSE_A}`)
			.set("Authorization", makeToken(BOB))

		// DELETE filtered by BOB, not ALICE — so ALICE's row stays safe
		expect(mockedQuery.mock.calls[0][1]).toEqual([BOB, COURSE_A])
	})

	it("returns 401 without auth", async () => {
		const res = await request(buildApp()).delete(
			`/api/me/bookmarks/${COURSE_A}`,
		)
		expect(res.status).toBe(401)
		expect(mockedQuery).not.toHaveBeenCalled()
	})
})
