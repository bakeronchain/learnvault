jest.mock("../db/index", () => ({
	pool: {
		query: jest.fn(),
		totalCount: 12,
		idleCount: 7,
		waitingCount: 1,
	},
}))

const mockRedisPing = jest.fn()
const mockRedisDisconnect = jest.fn()

jest.mock("ioredis", () => {
	return jest.fn().mockImplementation(() => ({
		ping: mockRedisPing,
		disconnect: mockRedisDisconnect,
	}))
})

import express from "express"
import Redis from "ioredis"
import request from "supertest"

import { pool } from "../db/index"
import { healthRouter } from "../routes/health.routes"

const mockedPoolQuery = pool.query as jest.Mock
const mockedFetch = jest.fn()
const originalEnv = process.env

function buildApp() {
	const app = express()
	app.use("/api", healthRouter)
	return app
}

beforeAll(() => {
	;(global as unknown as { fetch: typeof fetch }).fetch =
		mockedFetch as unknown as typeof fetch
})

beforeEach(() => {
	process.env = { ...originalEnv }
	mockedPoolQuery.mockReset()
	mockRedisPing.mockReset()
	mockRedisDisconnect.mockReset()
	mockedFetch.mockReset()
	;(Redis as unknown as jest.Mock).mockClear()
})

afterAll(() => {
	process.env = originalEnv
})

describe("GET /api/health", () => {
	it("returns healthy when database, redis and horizon checks pass", async () => {
		process.env.REDIS_URL = "redis://localhost:6379"
		process.env.STELLAR_HORIZON_URL = "https://horizon-testnet.stellar.org"
		process.env.GIT_COMMIT_SHA = "abc123"

		mockedPoolQuery.mockResolvedValue({ rows: [{ one: 1 }] })
		mockRedisPing.mockResolvedValue("PONG")
		mockedFetch.mockResolvedValue({ ok: true, status: 200 } as Response)

		const res = await request(buildApp()).get("/api/health")

		expect(res.status).toBe(200)
		expect(res.body.status).toBe("healthy")
		expect(res.body.db).toBe("connected")
		expect(res.body.commitHash).toBe("abc123")
		expect(res.body.checks.database.status).toBe("healthy")
		expect(res.body.checks.redis.status).toBe("healthy")
		expect(res.body.checks.stellarHorizon.status).toBe("healthy")
		expect(res.body.dbPool).toEqual({
			totalConnections: 12,
			idleConnections: 7,
			waitingClients: 1,
		})
	})

	it("returns degraded when redis is not configured", async () => {
		delete process.env.REDIS_URL
		process.env.STELLAR_HORIZON_URL = "https://horizon-testnet.stellar.org"

		mockedPoolQuery.mockResolvedValue({ rows: [{ one: 1 }] })
		mockedFetch.mockResolvedValue({ ok: true, status: 200 } as Response)

		const res = await request(buildApp()).get("/api/health")

		expect(res.status).toBe(200)
		expect(res.body.status).toBe("degraded")
		expect(res.body.checks.redis.status).toBe("degraded")
		expect(res.body.checks.redis.details).toBe("REDIS_URL not configured")
		expect(Redis).not.toHaveBeenCalled()
	})

	it("returns unhealthy when database check fails", async () => {
		process.env.REDIS_URL = "redis://localhost:6379"
		process.env.STELLAR_HORIZON_URL = "https://horizon-testnet.stellar.org"

		mockedPoolQuery.mockRejectedValue(new Error("connection failed"))
		mockRedisPing.mockResolvedValue("PONG")
		mockedFetch.mockResolvedValue({ ok: true, status: 200 } as Response)

		const res = await request(buildApp()).get("/api/health")

		expect(res.status).toBe(503)
		expect(res.body.status).toBe("unhealthy")
		expect(res.body.db).toBe("disconnected")
		expect(res.body.checks.database.status).toBe("unhealthy")
	})

	it("returns degraded when horizon check fails", async () => {
		process.env.REDIS_URL = "redis://localhost:6379"
		process.env.STELLAR_HORIZON_URL = "https://horizon-testnet.stellar.org"

		mockedPoolQuery.mockResolvedValue({ rows: [{ one: 1 }] })
		mockRedisPing.mockResolvedValue("PONG")
		mockedFetch.mockRejectedValue(new Error("network timeout"))

		const res = await request(buildApp()).get("/api/health")

		expect(res.status).toBe(200)
		expect(res.body.status).toBe("degraded")
		expect(res.body.checks.stellarHorizon.status).toBe("unhealthy")
		expect(res.body.checks.stellarHorizon.url).toBe(
			"https://horizon-testnet.stellar.org",
		)
	})
})
