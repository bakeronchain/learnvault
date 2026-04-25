import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { pool } from "../db/index"
import { errorHandler } from "../middleware/error.middleware"
import { createCommentsRouter } from "../routes/comments.routes"

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

function makeToken(address = "GUSER123") {
	return jwt.sign({ address }, JWT_SECRET, { expiresIn: "1h" })
}

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use("/api", createCommentsRouter(testJwtService))
	app.use(errorHandler)
	return app
}

describe("Comments API", () => {
	const querySpy = jest.spyOn(pool, "query")

	beforeEach(() => {
		jest.clearAllMocks()
	})

	afterAll(() => {
		querySpy.mockRestore()
	})

	it("returns field-level validation errors for invalid snake_case payloads", async () => {
		const res = await request(buildApp())
			.post("/api/comments")
			.set("Authorization", `Bearer ${makeToken()}`)
			.send({
				proposal_id: "proposal-1",
				body: "",
				author_address: "GUSER123",
			})

		expect(res.status).toBe(400)
		expect(res.body.error).toBe("Validation failed")
		expect(res.body.details).toEqual([
			{
				field: "body",
				message: "body cannot be empty",
			},
		])
		expect(querySpy).not.toHaveBeenCalled()
	})

	it("accepts the issue payload shape when the author matches the token", async () => {
		querySpy
			.mockResolvedValueOnce({ rows: [{ count: "0" }] } as never)
			.mockResolvedValueOnce({ rows: [{ count: "0" }] } as never)
			.mockResolvedValueOnce({
				rows: [
					{
						id: 1,
						proposal_id: "proposal-1",
						author_address: "GUSER123",
						content: "Nice proposal",
					},
				],
			} as never)

		const res = await request(buildApp())
			.post("/api/comments")
			.set("Authorization", `Bearer ${makeToken()}`)
			.send({
				proposal_id: "proposal-1",
				body: "Nice proposal",
				author_address: "GUSER123",
			})

		expect(res.status).toBe(201)
		expect(res.body.author_address).toBe("GUSER123")
		expect(res.body.content).toBe("Nice proposal")
	})

	it("rejects comments longer than 2,000 characters", async () => {
		const res = await request(buildApp())
			.post("/api/comments")
			.set("Authorization", `Bearer ${makeToken()}`)
			.send({
				proposal_id: "proposal-1",
				body: "a".repeat(2001),
				author_address: "GUSER123",
			})

		expect(res.status).toBe(400)
		expect(res.body.error).toBe("Comment must be 2,000 characters or fewer")
		expect(querySpy).not.toHaveBeenCalled()
	})

	it("strips HTML tags before storing comments", async () => {
		querySpy
			.mockResolvedValueOnce({ rows: [{ count: "0" }] } as never)
			.mockResolvedValueOnce({ rows: [{ count: "0" }] } as never)
			.mockResolvedValueOnce({
				rows: [
					{
						id: 2,
						proposal_id: "proposal-1",
						author_address: "GUSER123",
						content: "Hello world",
					},
				],
			} as never)

		const res = await request(buildApp())
			.post("/api/comments")
			.set("Authorization", `Bearer ${makeToken()}`)
			.send({
				proposal_id: "proposal-1",
				body: "Hello <script>alert(1)</script> world",
				author_address: "GUSER123",
			})

		expect(res.status).toBe(201)
		expect(querySpy).toHaveBeenCalledTimes(3)
		const insertCallArgs = querySpy.mock.calls[2]?.[1] as unknown[]
		expect(insertCallArgs[2]).toBe("Hello  world")
	})

	it("rejects invalid parentId values", async () => {
		const res = await request(buildApp())
			.post("/api/comments")
			.set("Authorization", `Bearer ${makeToken()}`)
			.send({
				proposal_id: "proposal-1",
				body: "Reply",
				parent_id: 0,
				author_address: "GUSER123",
			})

		expect(res.status).toBe(400)
		expect(querySpy).not.toHaveBeenCalled()
	})

	it("enforces a global per-address daily comment limit", async () => {
		const previousMax = process.env.MAX_COMMENTS_PER_DAY
		process.env.MAX_COMMENTS_PER_DAY = "1"

		querySpy.mockResolvedValueOnce({ rows: [{ count: "1" }] } as never)

		const res = await request(buildApp())
			.post("/api/comments")
			.set("Authorization", `Bearer ${makeToken()}`)
			.send({
				proposal_id: "proposal-1",
				body: "Another comment",
				author_address: "GUSER123",
			})

		expect(res.status).toBe(429)
		expect(res.body.error).toBe("Global daily comment limit reached")

		if (previousMax === undefined) {
			delete process.env.MAX_COMMENTS_PER_DAY
		} else {
			process.env.MAX_COMMENTS_PER_DAY = previousMax
		}
	})

	it("PATCH updates content when called by the author", async () => {
		querySpy.mockResolvedValueOnce({
			rows: [
				{
					id: 4,
					proposal_id: "1",
					author_address: "GUSER123",
					content: "Updated text",
					parent_id: null,
					upvotes: 0,
					downvotes: 0,
					is_pinned: false,
					created_at: new Date().toISOString(),
				},
			],
			rowCount: 1,
		} as never)

		const res = await request(buildApp())
			.patch("/api/comments/4")
			.set("Authorization", `Bearer ${makeToken()}`)
			.send({ content: "Updated text" })

		expect(res.status).toBe(200)
		expect(res.body.content).toBe("Updated text")
	})

	it("PATCH returns 404 when comment does not exist or belongs to another user", async () => {
		querySpy.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)

		const res = await request(buildApp())
			.patch("/api/comments/4")
			.set(
				"Authorization",
				`Bearer ${jwt.sign({ address: "GOTHERUSER" }, JWT_SECRET, { expiresIn: "1h" })}`,
			)
			.send({ content: "Hijack" })

		expect(res.status).toBe(404)
		expect(res.body.error).toMatch(/not found|unauthorized/i)
	})

	it("PATCH returns 401 without auth token", async () => {
		const res = await request(buildApp())
			.patch("/api/comments/4")
			.send({ content: "No auth" })

		expect(res.status).toBe(401)
	})

	it("PATCH returns 400 when content is empty", async () => {
		const res = await request(buildApp())
			.patch("/api/comments/4")
			.set("Authorization", `Bearer ${makeToken()}`)
			.send({ content: "   " })

		expect(res.status).toBe(400)
		expect(res.body.error).toBe("Validation failed")
	})
})
