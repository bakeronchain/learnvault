import express from "express"
import request from "supertest"

// Stub the events controller so the test exercises the rate limiter wired in
// events.routes.ts without touching the database.
jest.mock("../controllers/events.controller", () => ({
	getEvents: (_req: express.Request, res: express.Response) =>
		res.status(200).json({ data: [] }),
}))

import { errorHandler } from "../middleware/error.middleware"
import { eventsRouter } from "../routes/events.routes"

const EVENTS_LIMIT = 100

describe("GET /api/events rate limiting", () => {
	let app: express.Application

	beforeEach(() => {
		app = express()
		app.set("trust proxy", 1) // honour X-Forwarded-For for per-IP buckets
		app.use(express.json())
		app.use("/api", eventsRouter)
		app.use(errorHandler)
	})

	it("allows up to the limit then returns 429 with a Retry-After header", async () => {
		const ip = "203.0.113.7"

		for (let i = 0; i < EVENTS_LIMIT; i++) {
			const res = await request(app)
				.get("/api/events")
				.set("X-Forwarded-For", ip)
			expect(res.status).toBe(200)
		}

		const blocked = await request(app)
			.get("/api/events")
			.set("X-Forwarded-For", ip)

		expect(blocked.status).toBe(429)
		expect(blocked.headers).toHaveProperty("retry-after")
		expect(Number(blocked.headers["retry-after"])).toBeGreaterThanOrEqual(0)
		expect(blocked.body.error).toMatch(/too many requests/i)
	})

	it("tracks separate buckets per IP", async () => {
		const floodedIp = "203.0.113.10"

		for (let i = 0; i < EVENTS_LIMIT; i++) {
			await request(app).get("/api/events").set("X-Forwarded-For", floodedIp)
		}
		const blocked = await request(app)
			.get("/api/events")
			.set("X-Forwarded-For", floodedIp)
		expect(blocked.status).toBe(429)

		// A different client is unaffected.
		const fresh = await request(app)
			.get("/api/events")
			.set("X-Forwarded-For", "203.0.113.11")
		expect(fresh.status).toBe(200)
	})
})
