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
import {
	languageFromParam,
	requireTranslator,
} from "../middleware/translator.middleware"

const mockedQuery = pool.query as jest.Mock
const JWT_SECRET = "learnvault-secret"

function buildApp() {
	const app = express()
	app.use(express.json())
	app.get(
		"/translate/:languageCode",
		requireTranslator(languageFromParam()),
		(req, res) => {
			res.status(200).json({ context: req.translatorContext })
		},
	)
	return app
}

beforeEach(() => {
	mockedQuery.mockReset()
	delete process.env.ADMIN_API_KEY
})

describe("requireTranslator", () => {
	it("rejects requests with no auth", async () => {
		const res = await request(buildApp()).get("/translate/sw")
		expect(res.status).toBe(401)
	})

	it("allows a wallet granted for the requested language", async () => {
		const token = jwt.sign({ sub: "GSWTRANSLATOR" }, JWT_SECRET, {
			expiresIn: "1h",
		})
		mockedQuery.mockResolvedValueOnce({
			rowCount: 1,
			rows: [{ "?column?": 1 }],
		})

		const res = await request(buildApp())
			.get("/translate/sw")
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(200)
		expect(res.body.context).toEqual({
			address: "GSWTRANSLATOR",
			language: "sw",
			isAdminBypass: false,
		})
	})

	// The scenario this proves: a translator scoped only to Swahili can never
	// reach a French-gated route, because the grants lookup is scoped to the
	// exact requested language. Publish endpoints go further and require
	// requireCourseAdmin instead of requireTranslator at all (see
	// translations.routes.ts), so a translator can never publish any
	// language — this is the narrower, per-language authorization check that
	// backs every other translator action (save draft, submit for review).
	it("rejects a wallet granted only for a different language", async () => {
		const token = jwt.sign({ sub: "GSWTRANSLATOR" }, JWT_SECRET, {
			expiresIn: "1h",
		})
		// No grant row returned for the requested language ("fr").
		mockedQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })

		const res = await request(buildApp())
			.get("/translate/fr")
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(403)
		expect(mockedQuery).toHaveBeenCalledWith(
			expect.stringContaining("FROM translator_grants"),
			["GSWTRANSLATOR", "fr"],
		)
	})

	it("allows a course-admin (JWT role) for any language without a grants lookup", async () => {
		const token = jwt.sign({ sub: "GADMIN", role: "admin" }, JWT_SECRET, {
			expiresIn: "1h",
		})

		const res = await request(buildApp())
			.get("/translate/fr")
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(200)
		expect(res.body.context.isAdminBypass).toBe(true)
		expect(mockedQuery).not.toHaveBeenCalled()
	})

	it("allows the admin api key for any language", async () => {
		process.env.ADMIN_API_KEY = "test-admin-key"
		const res = await request(buildApp())
			.get("/translate/sw")
			.set("x-api-key", "test-admin-key")

		expect(res.status).toBe(200)
		expect(res.body.context.isAdminBypass).toBe(true)
	})
})
