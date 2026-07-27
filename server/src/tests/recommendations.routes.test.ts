/**
 * Integration tests for the recommendations API surface: the address-based
 * public endpoint, the authenticated self endpoint, and per-learner caching.
 */

process.env.NODE_ENV = "test"
process.env.ENABLE_API_CACHE_IN_TESTS = "true"

jest.mock("../services/recommendation.service", () => ({
	getRecommendations: jest.fn(),
	logRecommendationEngagement: jest.fn(),
}))

import express from "express"
import request from "supertest"
import { _clearMemoryApiResponseCache } from "../lib/api-response-cache"
import { errorHandler } from "../middleware/error.middleware"
import { createRecommendationsRouter } from "../routes/recommendations.routes"
import { type JwtService } from "../services/jwt.service"
import { getRecommendations } from "../services/recommendation.service"

const testJwtService: JwtService = {
	signWalletToken: () => "mock-token",
	verifyWalletToken: async (_token: string) => ({
		sub: "GLEARNER1",
		jti: "test-jti",
	}),
	revokeToken: async () => {},
	signRefreshToken: () => "mock-refresh-token",
	issueTokenPair: () => ({
		accessToken: "mock-token",
		refreshToken: "mock-refresh-token",
	}),
	verifyRefreshToken: async () => ({ sub: "GLEARNER1", jti: "test-jti" }),
	rotateRefreshToken: async () => ({
		accessToken: "mock-token",
		refreshToken: "mock-refresh-token",
		sub: "GLEARNER1",
	}),
}

function buildApp(): express.Express {
	const app = express()
	app.use(express.json())
	app.use("/api", createRecommendationsRouter(testJwtService))
	app.use(errorHandler)
	return app
}

const SAMPLE_RECOMMENDATION = {
	courseId: "2",
	slug: "soroban-smart-contracts",
	title: "Soroban Smart Contracts",
	description: "Build on Soroban",
	track: "Stellar",
	difficulty: "intermediate" as const,
	coverImage: null,
	score: 60,
	reason: "Because you finished Stellar Basics",
}

beforeEach(() => {
	jest.clearAllMocks()
	_clearMemoryApiResponseCache()
	;(getRecommendations as jest.Mock).mockResolvedValue([SAMPLE_RECOMMENDATION])
})

describe("GET /api/recommendations/:address", () => {
	it("returns ranked recommendations with a reason, without requiring auth", async () => {
		const app = buildApp()
		const res = await request(app).get("/api/recommendations/GLEARNER1")

		expect(res.status).toBe(200)
		expect(res.body.data).toHaveLength(1)
		expect(res.body.data[0].reason).toBe("Because you finished Stellar Basics")
		expect(getRecommendations).toHaveBeenCalledWith("GLEARNER1", 4)
	})

	it("passes the limit query param through", async () => {
		const app = buildApp()
		await request(app).get("/api/recommendations/GLEARNER1?limit=2")

		expect(getRecommendations).toHaveBeenCalledWith("GLEARNER1", 2)
	})

	it("caches the response per learner address (second call is a cache hit and does not re-invoke the service)", async () => {
		const app = buildApp()

		const res1 = await request(app).get("/api/recommendations/GLEARNER1")
		expect(res1.headers["x-cache"]).toBe("MISS")

		const res2 = await request(app).get("/api/recommendations/GLEARNER1")
		expect(res2.headers["x-cache"]).toBe("HIT")

		expect(getRecommendations).toHaveBeenCalledTimes(1)
	})

	it("does not share cache entries across different learner addresses", async () => {
		const app = buildApp()

		await request(app).get("/api/recommendations/GLEARNER1")
		const res = await request(app).get("/api/recommendations/GLEARNER2")

		expect(res.headers["x-cache"]).toBe("MISS")
		expect(getRecommendations).toHaveBeenCalledTimes(2)
	})
})

describe("GET /api/recommendations", () => {
	it("requires authentication", async () => {
		const app = buildApp()
		const res = await request(app).get("/api/recommendations")

		expect(res.status).toBe(401)
	})

	it("returns recommendations for the authenticated wallet", async () => {
		const app = buildApp()
		const res = await request(app)
			.get("/api/recommendations")
			.set("Authorization", "Bearer mock-token")

		expect(res.status).toBe(200)
		expect(res.body.data).toHaveLength(1)
		expect(getRecommendations).toHaveBeenCalledWith("GLEARNER1", 4)
	})
})
