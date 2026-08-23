process.env.JWT_SECRET = "learnvault-secret"

jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
	},
}))

import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { pool } from "../db/index"
import { errorHandler } from "../middleware/error.middleware"
import { createTranslationsRouter } from "../routes/translations.routes"
import { type JwtService } from "../services/jwt.service"

const mockedQuery = pool.query as jest.Mock
const JWT_SECRET = "learnvault-secret"

const testJwtService = {
	signWalletToken: (address: string) =>
		jwt.sign({ sub: address, jti: "jti-test" }, JWT_SECRET),
	verifyWalletToken: async (token: string) => {
		const decoded = jwt.verify(token, JWT_SECRET) as { sub?: string }
		if (!decoded.sub) throw new Error("Invalid token")
		return { sub: decoded.sub, jti: "jti-test" }
	},
	revokeToken: async () => {},
}

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use(
		"/api",
		createTranslationsRouter(testJwtService as unknown as JwtService),
	)
	app.use(errorHandler)
	return app
}

const adminToken = jwt.sign({ sub: "GADMIN", role: "admin" }, JWT_SECRET, {
	expiresIn: "1h",
})
const swTranslatorToken = jwt.sign({ sub: "GSWTRANSLATOR" }, JWT_SECRET, {
	expiresIn: "1h",
})

beforeEach(() => {
	mockedQuery.mockReset()
	delete process.env.ADMIN_API_KEY
})

const MARKDOWN_FIXTURE = [
	"# Heading",
	"",
	"Some prose with a [link](https://stellar.org) in it.",
	"",
	"```js",
	"const escrow = 1;",
	"```",
	"",
	"**Bold** text and a list:",
	"- one",
	"- two",
].join("\n")

describe("PUT /api/courses/:idOrSlug/lessons/:orderIndex/translations/:languageCode", () => {
	it("stores markdown byte-for-byte, with no sanitization applied", async () => {
		mockedQuery
			// requireTranslator: translator_grants lookup
			.mockResolvedValueOnce({ rowCount: 1, rows: [{ "?column?": 1 }] })
			// resolveCourse
			.mockResolvedValueOnce({
				rows: [{ id: 4, slug: "stellar-basics", content_version: 1 }],
			})
			// resolveActiveLesson
			.mockResolvedValueOnce({
				rows: [{ title: "Intro", content_markdown: "old", version: 1 }],
			})
			// upsert INSERT ... RETURNING *
			.mockResolvedValueOnce({
				rows: [
					{
						id: 1,
						course_id: 4,
						order_index: 1,
						language_code: "sw",
						title: "Kichwa",
						content_markdown: MARKDOWN_FIXTURE,
						status: "draft",
						translator_address: "GSWTRANSLATOR",
						source_version: 1,
						is_stale: false,
					},
				],
			})

		const res = await request(buildApp())
			.put("/api/courses/stellar-basics/lessons/1/translations/sw")
			.set("Authorization", `Bearer ${swTranslatorToken}`)
			.send({ title: "Kichwa", content: MARKDOWN_FIXTURE })

		expect(res.status).toBe(200)
		expect(res.body.content).toBe(MARKDOWN_FIXTURE)

		const insertCall = mockedQuery.mock.calls[3]
		expect(insertCall[1]).toContain(MARKDOWN_FIXTURE)
	})
})

describe("Translator scoping on publish", () => {
	it("a wallet granted only for sw cannot publish fr (publish is admin-only)", async () => {
		const res = await request(buildApp())
			.post("/api/courses/stellar-basics/translations/fr/publish")
			.set("Authorization", `Bearer ${swTranslatorToken}`)

		expect(res.status).toBe(403)
		// requireCourseAdmin rejects before any translations query runs.
		expect(mockedQuery).not.toHaveBeenCalled()
	})

	it("a wallet granted only for sw also cannot publish its own sw translation", async () => {
		const res = await request(buildApp())
			.post("/api/courses/stellar-basics/translations/sw/publish")
			.set("Authorization", `Bearer ${swTranslatorToken}`)

		expect(res.status).toBe(403)
	})

	it("course-admin can publish any language", async () => {
		mockedQuery
			.mockResolvedValueOnce({
				rows: [{ id: 4, slug: "stellar-basics", content_version: 2 }],
			})
			.mockResolvedValueOnce({
				rows: [
					{
						id: 1,
						course_id: 4,
						language_code: "sw",
						title: "Kichwa",
						description: "Maelezo",
						status: "published",
						translator_address: "GSWTRANSLATOR",
						source_version: 2,
						is_stale: false,
					},
				],
			})

		const res = await request(buildApp())
			.post("/api/courses/stellar-basics/translations/sw/publish")
			.set("Authorization", `Bearer ${adminToken}`)

		expect(res.status).toBe(200)
		expect(res.body.status).toBe("published")
	})
})

describe("Draft/in_review submit gating", () => {
	it("submit fails with 400 when there is nothing draft/stale to submit", async () => {
		mockedQuery
			// requireTranslator: translator_grants lookup
			.mockResolvedValueOnce({ rowCount: 1, rows: [{ "?column?": 1 }] })
			.mockResolvedValueOnce({
				rows: [{ id: 4, slug: "stellar-basics", content_version: 1 }],
			})
			// UPDATE ... WHERE status='draft' OR is_stale matched nothing
			.mockResolvedValueOnce({ rows: [] })

		const res = await request(buildApp())
			.post("/api/courses/stellar-basics/translations/sw/submit")
			.set("Authorization", `Bearer ${swTranslatorToken}`)

		expect(res.status).toBe(400)
	})
})
