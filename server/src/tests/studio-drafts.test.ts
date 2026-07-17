process.env.JWT_SECRET = "learnvault-secret"

jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
		connect: jest.fn(),
	},
}))

import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { pool } from "../db/index"
import { errorHandler } from "../middleware/error.middleware"
import { createStudioDraftsRouter } from "../routes/studio-drafts.routes"

const mockedQuery = pool.query as jest.Mock
const JWT_SECRET = "learnvault-secret"

const userToken = jwt.sign({ sub: "GUSER" }, JWT_SECRET, { expiresIn: "1h" })
const adminToken = jwt.sign({ sub: "GADMIN" }, JWT_SECRET, { expiresIn: "1h" })

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use("/api", createStudioDraftsRouter({
		signWalletToken: (address: string) => jwt.sign({ sub: address }, JWT_SECRET),
		verifyWalletToken: async (token: string) => {
			const payload = jwt.verify(token, JWT_SECRET) as { sub?: string }
			return { sub: payload.sub ?? "", jti: "mock-jti" }
		},
	} as any))
	app.use(errorHandler)
	return app
}

beforeEach(() => {
	mockedQuery.mockReset()
	process.env.COURSE_DRAFT_LRN_THRESHOLD = "100"
})

describe("studio draft lifecycle", () => {
	it("rejects draft creation for users below the LRN threshold", async () => {
		mockedQuery.mockResolvedValueOnce({ rows: [{ bal: "99" }] })

		const res = await request(buildApp())
			.post("/api/studio/drafts")
			.set("Authorization", `Bearer ${userToken}`)
			.send({ title: "My Draft", description: "Hello" })

		expect(res.status).toBe(403)
		expect(res.body.error).toContain("threshold")
	})

	it("creates a draft for qualified creators", async () => {
		mockedQuery
			.mockResolvedValueOnce({ rows: [{ bal: "100" }] })
			.mockResolvedValueOnce({
				rows: [{ id: 12, author_addr: "GUSER", title: "My Draft", description: "Hello", difficulty: "beginner", status: "draft", content: {}, review_notes: null, created_at: "now", updated_at: "now" }],
			})

		const res = await request(buildApp())
			.post("/api/studio/drafts")
			.set("Authorization", `Bearer ${userToken}`)
			.send({ title: "My Draft", description: "Hello", difficulty: "beginner" })

		expect(res.status).toBe(201)
		expect(res.body.status).toBe("draft")
	})

	it("autosaves content updates", async () => {
		mockedQuery
			.mockResolvedValueOnce({
				rows: [{ id: 12, author_addr: "GUSER", title: "My Draft", description: "Hello", difficulty: "beginner", status: "draft", content: {}, review_notes: null, created_at: "now", updated_at: "now" }],
			})
			.mockResolvedValueOnce({
				rows: [{ id: 12, author_addr: "GUSER", title: "Updated Title", description: "Hello", difficulty: "beginner", status: "draft", content: { lessons: [{ title: "Intro" }] }, review_notes: null, created_at: "now", updated_at: "now" }],
			})

		const res = await request(buildApp())
			.put("/api/studio/drafts/12")
			.set("Authorization", `Bearer ${userToken}`)
			.send({ title: "Updated Title", content: { lessons: [{ title: "Intro" }] } })

		expect(res.status).toBe(200)
		expect(res.body.title).toBe("Updated Title")
	})

	it("submits a draft for review", async () => {
		mockedQuery
			.mockResolvedValueOnce({
				rows: [{ id: 12, author_addr: "GUSER", title: "My Draft", description: "Hello", difficulty: "beginner", status: "draft", content: {}, review_notes: null, created_at: "now", updated_at: "now" }],
			})
			.mockResolvedValueOnce({
				rows: [{ id: 12, author_addr: "GUSER", title: "My Draft", description: "Hello", difficulty: "beginner", status: "in_review", content: {}, review_notes: null, created_at: "now", updated_at: "now" }],
			})

		const res = await request(buildApp())
			.post("/api/studio/drafts/12/submit")
			.set("Authorization", `Bearer ${userToken}`)

		expect(res.status).toBe(200)
		expect(res.body.status).toBe("in_review")
	})

	it("approves a draft and materializes it into the public catalog", async () => {
		mockedQuery
			.mockResolvedValueOnce({ rows: [{ id: 12, author_addr: "GUSER", title: "My Draft", description: "Hello", difficulty: "beginner", status: "in_review", content: { lessons: [{ title: "Intro", content: "hello" }] }, review_notes: null, created_at: "now", updated_at: "now" }] })
			.mockResolvedValueOnce({ rows: [{ id: 12, author_addr: "GUSER", title: "My Draft", description: "Hello", difficulty: "beginner", status: "approved", content: { lessons: [{ title: "Intro", content: "hello" }] }, review_notes: "Looks good", created_at: "now", updated_at: "now" }] })
			.mockResolvedValueOnce({ rows: [{ id: 77, slug: "my-draft", title: "My Draft", description: "Hello", difficulty: "beginner", track: "general", cover_image_url: null, published_at: null, created_at: "now", updated_at: "now", prerequisites: [] }] })
			.mockResolvedValueOnce({ rows: [{ id: 1 }] })
			.mockResolvedValueOnce({ rows: [{ id: 2 }] })
			.mockResolvedValueOnce({ rows: [] })

		const res = await request(buildApp())
			.post("/api/admin/studio/drafts/12/review")
			.set("Authorization", `Bearer ${adminToken}`)
			.send({ decision: "approve", notes: "Looks good" })

		expect(res.status).toBe(200)
		expect(res.body.status).toBe("approved")
		expect(mockedQuery).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO courses"), expect.any(Array))
	})
})
