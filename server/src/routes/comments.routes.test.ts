import express, { type Express } from "express"
import jwt from "jsonwebtoken"
import request from "supertest"

// ── Mocks must be declared before any imports that use these modules ─────────

const mockClient = {
	query: jest.fn(),
	release: jest.fn(),
}

jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn(),
		connect: jest.fn(),
	},
}))

import { pool } from "../db/index"
import { createCommentsRouter } from "./comments.routes"

const mockedQuery = pool.query as jest.Mock
const mockedConnect = pool.connect as jest.Mock

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_SECRET = "learnvault-secret"
const AUTHOR = "GABC1234567890AUTHOR"
const OTHER = "GDEF9876543210OTHER"
const PROPOSAL_AUTHOR = "GPROP_AUTHOR_ADDRESS0"

/** Generate a test Bearer token for a given address */
const makeToken = (address: string) =>
	`Bearer ${jwt.sign({ sub: address }, TEST_SECRET)}`

const testJwtService = {
	signWalletToken: (address: string) => jwt.sign({ sub: address }, TEST_SECRET),
	verifyWalletToken: (token: string) => {
		const decoded = jwt.verify(token, TEST_SECRET) as {
			sub?: string
			address?: string
		}
		const sub = decoded.sub ?? decoded.address ?? ""
		if (!sub) throw new Error("Invalid token")
		return { sub }
	},
}

const buildApp = (): Express => {
	const app = express()
	app.use(express.json())
	app.use("/api", createCommentsRouter(testJwtService))
	return app
}

beforeEach(() => {
	jest.clearAllMocks()
	mockClient.query.mockReset()
	mockClient.release.mockReset()
	mockedConnect.mockResolvedValue(mockClient)
})

// ── GET /api/proposals/:proposalId/comments ───────────────────────────────────

describe("GET /api/proposals/:proposalId/comments", () => {
	it("returns comments for a proposal", async () => {
		const rows = [
			{
				id: 1,
				proposal_id: "42",
				content: "Great proposal!",
				author_address: AUTHOR,
				is_pinned: false,
				created_at: new Date().toISOString(),
				deleted_at: null,
			},
		]
		mockedQuery.mockResolvedValueOnce({ rows })

		const res = await request(buildApp()).get("/api/proposals/42/comments")

		expect(res.status).toBe(200)
		expect(res.body).toHaveLength(1)
		expect(res.body[0].proposal_id).toBe("42")
	})

	it("returns empty array when no comments exist", async () => {
		mockedQuery.mockResolvedValueOnce({ rows: [] })

		const res = await request(buildApp()).get("/api/proposals/99/comments")

		expect(res.status).toBe(200)
		expect(res.body).toEqual([])
	})

	it("returns 500 on database error", async () => {
		mockedQuery.mockRejectedValueOnce(new Error("DB connection lost"))

		const res = await request(buildApp()).get("/api/proposals/1/comments")

		expect(res.status).toBe(500)
		expect(res.body.error).toBe("Failed to fetch comments")
	})

	it("respects limit and offset query params", async () => {
		mockedQuery.mockResolvedValueOnce({ rows: [] })

		const res = await request(buildApp()).get(
			"/api/proposals/1/comments?limit=5&offset=10",
		)

		expect(res.status).toBe(200)
		expect(mockedQuery).toHaveBeenCalledWith(expect.stringContaining("LIMIT"), [
			"1",
			5,
			10,
		])
	})

	it("caps limit at 100 even if a larger value is sent", async () => {
		mockedQuery.mockResolvedValueOnce({ rows: [] })

		await request(buildApp()).get("/api/proposals/1/comments?limit=500")

		const [, params] = mockedQuery.mock.calls[0]
		expect(params[1]).toBe(100)
	})
})

// ── POST /api/comments ────────────────────────────────────────────────────────

describe("POST /api/comments", () => {
	it("creates a comment and returns 201", async () => {
		const newComment = {
			id: 10,
			proposal_id: "5",
			author_address: AUTHOR,
			content: "Nice idea",
			parent_id: null,
			is_pinned: false,
			created_at: new Date().toISOString(),
		}
		// spam check returns count 0, then insert
		mockedQuery
			.mockResolvedValueOnce({ rows: [{ count: "0" }] })
			.mockResolvedValueOnce({ rows: [{ count: "0" }] })
			.mockResolvedValueOnce({ rows: [newComment] })

		const res = await request(buildApp())
			.post("/api/comments")
			.set("Authorization", makeToken(AUTHOR))
			.send({ proposal_id: "5", content: "Nice idea" })

		expect(res.status).toBe(201)
		expect(res.body.content).toBe("Nice idea")
		expect(res.body.author_address).toBe(AUTHOR)
	})

	it("rejects comment content over 2,000 characters", async () => {
		const tooLong = "a".repeat(2001)

		const res = await request(buildApp())
			.post("/api/comments")
			.set("Authorization", makeToken(AUTHOR))
			.send({ proposal_id: "5", content: tooLong })

		expect(res.status).toBe(400)
		expect(res.body.error).toBe("Comment must be 2,000 characters or fewer")
		expect(mockedQuery).not.toHaveBeenCalled()
	})

	it("strips HTML tags from comment content before storage", async () => {
		const insertedComment = {
			id: 11,
			proposal_id: "5",
			author_address: AUTHOR,
			content: "Hello alert(1) world",
			parent_id: null,
			is_pinned: false,
			created_at: new Date().toISOString(),
		}

		mockedQuery
			.mockResolvedValueOnce({ rows: [{ count: "0" }] })
			.mockResolvedValueOnce({ rows: [{ count: "0" }] })
			.mockResolvedValueOnce({ rows: [insertedComment] })

		const res = await request(buildApp())
			.post("/api/comments")
			.set("Authorization", makeToken(AUTHOR))
			.send({ proposal_id: "5", content: "Hello <script>alert(1)</script> world" })

		expect(res.status).toBe(201)
		expect(mockedQuery).toHaveBeenNthCalledWith(
			3,
			expect.stringContaining("INSERT INTO comments"),
			expect.arrayContaining(["5", AUTHOR, "Hello  world", null]),
		)
	})

	it("returns 400 when required fields are missing", async () => {
		const res = await request(buildApp())
			.post("/api/comments")
			.set("Authorization", makeToken(AUTHOR))
			.send({})

		expect(res.status).toBe(400)
	})

	it("returns 429 when daily comment limit is reached", async () => {
		mockedQuery.mockResolvedValueOnce({ rows: [{ count: "5" }] })

		const res = await request(buildApp())
			.post("/api/comments")
			.set("Authorization", makeToken(AUTHOR))
			.send({ proposal_id: "5", content: "Spam" })

		expect(res.status).toBe(429)
		expect(res.body.error).toMatch(/limit/i)
	})

	it("returns 401 without auth token", async () => {
		const res = await request(buildApp())
			.post("/api/comments")
			.send({ proposal_id: "5", content: "No auth" })

		expect(res.status).toBe(401)
	})

	it("returns 400 when author_address does not match authenticated user", async () => {
		const res = await request(buildApp())
			.post("/api/comments")
			.set("Authorization", makeToken(AUTHOR))
			.send({
				proposal_id: "5",
				content: "Impersonation",
				author_address: OTHER,
			})

		expect(res.status).toBe(400)
	})

	it("returns 400 when parentId is not a positive integer", async () => {
		const res = await request(buildApp())
			.post("/api/comments")
			.set("Authorization", makeToken(AUTHOR))
			.send({ proposal_id: "5", content: "Reply", parentId: "abc" })

		expect(res.status).toBe(400)
		expect(mockedQuery).not.toHaveBeenCalled()
	})
})

// ── POST /api/comments/:id/pin ────────────────────────────────────────────────

describe("PUT /api/comments/:id/pin", () => {
	it("allows the proposal author to pin a comment", async () => {
		// 1. fetch comment → proposal_id = 10
		mockedQuery.mockResolvedValueOnce({
			rows: [{ proposal_id: "10" }],
			rowCount: 1,
		})
		// 2. fetch proposal → author = PROPOSAL_AUTHOR
		mockedQuery.mockResolvedValueOnce({
			rows: [{ author_address: PROPOSAL_AUTHOR }],
			rowCount: 1,
		})
		// 3. unpin all
		mockedQuery.mockResolvedValueOnce({ rows: [] })
		// 4. pin this one
		mockedQuery.mockResolvedValueOnce({ rows: [] })

		const res = await request(buildApp())
			.put("/api/comments/7/pin")
			.set("Authorization", makeToken(PROPOSAL_AUTHOR))

		expect(res.status).toBe(200)
		expect(res.body.message).toBe("Comment pinned")
	})

	it("returns 403 when a non-author tries to pin", async () => {
		// 1. fetch comment
		mockedQuery.mockResolvedValueOnce({
			rows: [{ proposal_id: "10" }],
			rowCount: 1,
		})
		// 2. fetch proposal → different author
		mockedQuery.mockResolvedValueOnce({
			rows: [{ author_address: PROPOSAL_AUTHOR }],
			rowCount: 1,
		})

		const res = await request(buildApp())
			.put("/api/comments/7/pin")
			.set("Authorization", makeToken(OTHER))

		expect(res.status).toBe(403)
		expect(res.body.error).toMatch(/proposal author/i)
	})

	it("returns 404 when comment does not exist", async () => {
		mockedQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })

		const res = await request(buildApp())
			.put("/api/comments/999/pin")
			.set("Authorization", makeToken(AUTHOR))

		expect(res.status).toBe(404)
	})

	it("returns 401 without auth token", async () => {
		const res = await request(buildApp()).put("/api/comments/7/pin")

		expect(res.status).toBe(401)
	})
})

// ── DELETE /api/comments/:id ──────────────────────────────────────────────────

describe("DELETE /api/comments/:id", () => {
	it("soft-deletes the comment when called by the author", async () => {
		// check ownership returns row
		mockedQuery.mockResolvedValueOnce({
			rows: [{ id: 3, author_address: AUTHOR }],
			rowCount: 1,
		})
		// soft-delete update
		mockedQuery.mockResolvedValueOnce({ rows: [] })

		const res = await request(buildApp())
			.delete("/api/comments/3")
			.set("Authorization", makeToken(AUTHOR))

		expect(res.status).toBe(200)
		expect(res.body.success).toBe(true)
		// Verify the UPDATE sets deleted_at
		const updateCall = mockedQuery.mock.calls[1]
		expect(updateCall[0]).toMatch(/deleted_at/i)
	})

	it("returns 404 when comment does not exist or belongs to another user", async () => {
		mockedQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })

		const res = await request(buildApp())
			.delete("/api/comments/3")
			.set("Authorization", makeToken(OTHER))

		expect(res.status).toBe(404)
		expect(res.body.error).toMatch(/not found|unauthorized/i)
	})

	it("returns 401 without auth token", async () => {
		const res = await request(buildApp()).delete("/api/comments/3")

		expect(res.status).toBe(401)
	})
})
