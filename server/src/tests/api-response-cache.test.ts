process.env.NODE_ENV = "test"
process.env.ENABLE_API_CACHE_IN_TESTS = "true"

import express, { type Express } from "express"
import request from "supertest"
import { apiResponseCache } from "../middleware/api-response-cache.middleware"
import { _clearMemoryApiResponseCache } from "../lib/api-response-cache"

describe("apiResponseCache middleware", () => {
	beforeEach(() => {
		_clearMemoryApiResponseCache()
	})

	it("sets X-Cache header and caches GET JSON responses", async () => {
		let calls = 0

		const app: Express = express()
		app.use(express.json())
		app.get(
			"/api/leaderboard",
			apiResponseCache("leaderboard"),
			(_req, res) => {
				calls++
				return res.status(200).json({ calls })
			},
		)

		const res1 = await request(app).get("/api/leaderboard?limit=2")
		expect(res1.status).toBe(200)
		expect(res1.headers["x-cache"]).toBe("MISS")
		expect(res1.body).toEqual({ calls: 1 })

		const res2 = await request(app).get("/api/leaderboard?limit=2")
		expect(res2.status).toBe(200)
		expect(res2.headers["x-cache"]).toBe("HIT")
		expect(res2.body).toEqual({ calls: 1 })
		expect(calls).toBe(1)

		// Different query string => different cache key.
		const res3 = await request(app).get("/api/leaderboard?limit=3")
		expect(res3.headers["x-cache"]).toBe("MISS")
		expect(res3.body).toEqual({ calls: 2 })
		expect(calls).toBe(2)
	})

	it("does not cache non-200 responses", async () => {
		let calls = 0
		let failedOnce = false

		const app: Express = express()
		app.use(express.json())
		app.get(
			"/api/treasury/stats",
			apiResponseCache("treasury_stats"),
			(_req, res) => {
				calls++
				if (!failedOnce) {
					failedOnce = true
					return res.status(500).json({ error: "boom" })
				}
				return res.status(200).json({ ok: true })
			},
		)

		const res1 = await request(app).get("/api/treasury/stats")
		expect(res1.status).toBe(500)
		expect(res1.headers["x-cache"]).toBe("MISS")
		expect(calls).toBe(1)

		// Since 500 is not cached, the second call should invoke the handler again.
		const res2 = await request(app).get("/api/treasury/stats")
		expect(res2.status).toBe(200)
		expect(res2.headers["x-cache"]).toBe("MISS")
		expect(res2.body).toEqual({ ok: true })
		expect(calls).toBe(2)
	})
})

