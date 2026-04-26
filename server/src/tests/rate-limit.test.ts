import express from "express"
import request from "supertest"
import { globalLimiter, authVerifyLimiter, milestoneSubmissionLimiter } from "../middleware/rate-limit.middleware"
import { nonceRateLimiter } from "../middleware/nonce-rate-limit.middleware"
import { errorHandler } from "../middleware/error.middleware"

describe("Rate Limiting Middleware", () => {
	let app: express.Application

	beforeEach(() => {
		app = express()
		app.set("trust proxy", 1) // Required for X-Forwarded-For to work
		app.use(express.json())
		app.use(globalLimiter)

		// Dummy routes to test rate limiters
		app.get("/api/auth/nonce", nonceRateLimiter, (req, res) => res.status(200).send("nonce"))
		app.post("/api/auth/verify", authVerifyLimiter, (req, res) => res.status(200).send("verify"))
		app.post("/api/milestones", milestoneSubmissionLimiter, (req, res) => res.status(201).send("submit"))
		app.get("/api/admin/stats", (req, res) => res.status(200).send("admin stats")) // Only global limiter

		app.use(errorHandler)
	})

	describe("Nonce Rate Limiter (10 per min)", () => {
		it("blocks after 10 requests and includes RateLimit headers", async () => {
			const ip = "1.2.3.4"
			// First 10 requests should pass
			for (let i = 0; i < 10; i++) {
				const res = await request(app)
					.get("/api/auth/nonce")
					.set("X-Forwarded-For", ip)
				expect(res.status).toBe(200)
				expect(res.headers).toHaveProperty("ratelimit-remaining")
			}

			// 11th request should be blocked
			const res = await request(app)
				.get("/api/auth/nonce")
				.set("X-Forwarded-For", ip)
			
			expect(res.status).toBe(429)
			expect(res.body.error).toMatch(/too many nonce requests/i)
		})

		it("resets after the window expires", async () => {
			const ip = "3.3.3.3"
			jest.useFakeTimers()
			jest.setSystemTime(new Date("2026-01-01T00:00:00Z"))

			// Reach limit
			for (let i = 0; i < 10; i++) {
				await request(app).get("/api/auth/nonce").set("X-Forwarded-For", ip)
			}
			const res1 = await request(app).get("/api/auth/nonce").set("X-Forwarded-For", ip)
			expect(res1.status).toBe(429)

			// Advance time by 61 seconds (window is 60s)
			jest.advanceTimersByTime(61 * 1000)
			jest.setSystemTime(new Date("2026-01-01T00:01:01Z"))

			// Should pass now
			const res2 = await request(app).get("/api/auth/nonce").set("X-Forwarded-For", ip)
			expect(res2.status).toBe(200)

			jest.useRealTimers()
		})

		it("allows different IPs separate buckets", async () => {
			// IP 1 reaches limit
			for (let i = 0; i < 10; i++) {
				await request(app).get("/api/auth/nonce").set("X-Forwarded-For", "1.1.1.1")
			}
			const res1 = await request(app).get("/api/auth/nonce").set("X-Forwarded-For", "1.1.1.1")
			expect(res1.status).toBe(429)

			// IP 2 should still be fine
			const res2 = await request(app).get("/api/auth/nonce").set("X-Forwarded-For", "2.2.2.2")
			expect(res2.status).toBe(200)
		})
	})

	describe("Auth Verify Rate Limiter (10 per 15min)", () => {
		it("blocks after 10 requests", async () => {
			const ip = "5.6.7.8"
			for (let i = 0; i < 10; i++) {
				const res = await request(app)
					.post("/api/auth/verify")
					.set("X-Forwarded-For", ip)
					.send({ address: "G..." })
				expect(res.status).toBe(200)
			}

			const res = await request(app)
				.post("/api/auth/verify")
				.set("X-Forwarded-For", ip)
				.send({ address: "G..." })
			
			expect(res.status).toBe(429)
		})
	})

	describe("Milestone Submission Rate Limiter (10 per hour)", () => {
		it("blocks after 10 requests for the same scholar address", async () => {
			const scholarAddress = "GSCHOLAR123"
			const ip = "9.10.11.12"

			for (let i = 0; i < 10; i++) {
				const res = await request(app)
					.post("/api/milestones")
					.set("X-Forwarded-For", ip)
					.send({ scholarAddress })
				expect(res.status).toBe(201)
			}

			const res = await request(app)
				.post("/api/milestones")
				.set("X-Forwarded-For", ip)
				.send({ scholarAddress })
			
			expect(res.status).toBe(429)
		})

		it("allows different scholar addresses even from same IP", async () => {
			const ip = "13.14.15.16"
			
			// Address 1 reaches limit
			for (let i = 0; i < 10; i++) {
				await request(app).post("/api/milestones").set("X-Forwarded-For", ip).send({ scholarAddress: "A1" })
			}
			const res1 = await request(app).post("/api/milestones").set("X-Forwarded-For", ip).send({ scholarAddress: "A1" })
			expect(res1.status).toBe(429)

			// Address 2 should still be fine from same IP
			const res2 = await request(app).post("/api/milestones").set("X-Forwarded-For", ip).send({ scholarAddress: "A2" })
			expect(res2.status).toBe(201)
		})
	})

	describe("Admin Endpoints & Global Limiter", () => {
		it("admin endpoints only have global limit (100) and not functional limits (10)", async () => {
			const ip = "17.18.19.20"
			
			// Functional limit is 10, so we send 15 requests
			for (let i = 0; i < 15; i++) {
				const res = await request(app)
					.get("/api/admin/stats")
					.set("X-Forwarded-For", ip)
				expect(res.status).toBe(200)
			}
			
			// Should still pass because global limit is 100
			const res = await request(app)
				.get("/api/admin/stats")
				.set("X-Forwarded-For", ip)
			expect(res.status).toBe(200)
		})
	})
})
