import express from "express"
import request from "supertest"

import { apiVersionRedirect } from "../middleware/api-version.middleware"

describe("apiVersionRedirect", () => {
	let app: express.Application

	beforeEach(() => {
		app = express()
		app.use(apiVersionRedirect)
		// Versioned routes the redirect should land on.
		app.get("/api/v1/courses", (_req, res) => res.status(200).json({ v: 1 }))
		app.get("/api/v1/health", (_req, res) => res.status(200).send("ok"))
		// A non-versioned infrastructure route that must NOT be redirected.
		app.get("/api/docs", (_req, res) => res.status(200).send("docs"))
	})

	it("301-redirects a legacy /api path to its /api/v1 equivalent", async () => {
		const res = await request(app).get("/api/courses").redirects(0)
		expect(res.status).toBe(301)
		expect(res.headers.location).toBe("/api/v1/courses")
	})

	it("preserves the query string when redirecting", async () => {
		const res = await request(app).get("/api/courses?limit=5&q=rust").redirects(0)
		expect(res.status).toBe(301)
		expect(res.headers.location).toBe("/api/v1/courses?limit=5&q=rust")
	})

	it("does not redirect requests already under /api/v1", async () => {
		const res = await request(app).get("/api/v1/health").redirects(0)
		expect(res.status).toBe(200)
		expect(res.text).toBe("ok")
	})

	it("does not redirect excluded infrastructure paths (/api/docs)", async () => {
		const res = await request(app).get("/api/docs").redirects(0)
		expect(res.status).toBe(200)
		expect(res.text).toBe("docs")
	})

	it("ignores non-api paths", async () => {
		app.get("/healthz", (_req, res) => res.status(200).send("live"))
		const res = await request(app).get("/healthz").redirects(0)
		expect(res.status).toBe(200)
	})
})
