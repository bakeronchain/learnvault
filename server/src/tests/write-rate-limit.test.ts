import express from "express"
import request from "supertest"

import { errorHandler } from "../middleware/error.middleware"
import { writeLimiter } from "../middleware/rate-limit.middleware"

const WRITE_LIMIT = 20

describe("writeLimiter (mutation routes)", () => {
	let app: express.Application

	beforeEach(() => {
		app = express()
		app.set("trust proxy", 1)
		app.use(express.json())
		app.post("/api/things", writeLimiter, (_req, res) =>
			res.status(201).json({ ok: true }),
		)
		app.use(errorHandler)
	})

	it("allows 20 writes then blocks the 21st with 429 + Retry-After", async () => {
		const ip = "198.51.100.5"

		for (let i = 0; i < WRITE_LIMIT; i++) {
			const res = await request(app)
				.post("/api/things")
				.set("X-Forwarded-For", ip)
				.send({})
			expect(res.status).toBe(201)
		}

		const blocked = await request(app)
			.post("/api/things")
			.set("X-Forwarded-For", ip)
			.send({})

		expect(blocked.status).toBe(429)
		expect(blocked.headers).toHaveProperty("retry-after")
		expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0)
	})
})
