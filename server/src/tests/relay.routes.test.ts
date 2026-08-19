/**
 * Integration tests for POST /api/relay/fee-bump (#1054).
 * relayer.service is mocked here — this file exercises routing, auth gating,
 * rejection-reason propagation, and the per-account rate limiter end to end.
 * The relayer's own guardrail logic is covered directly in
 * relayer.service.test.ts against real, locally-built transaction envelopes.
 *
 * feeBumpRelayLimiter is a shared singleton keyed by learner address (see
 * wallet.routes.test.ts's authVerifyLimiter comment for the same gotcha) —
 * every test below uses its own unique learner address so consumed quota
 * never leaks between test cases.
 */

jest.mock("../services/relayer.service", () => {
	const actual = jest.requireActual("../services/relayer.service")
	return {
		...actual,
		submitFeeBump: jest.fn(),
	}
})

import express from "express"
import request from "supertest"
import { createRelayRouter } from "../routes/relay.routes"
import { type JwtService } from "../services/jwt.service"
import { RelayRejection, submitFeeBump } from "../services/relayer.service"

let learnerCounter = 0
function uniqueLearnerAddress(): string {
	learnerCounter += 1
	return `GLEARNER${learnerCounter.toString().padStart(48, "0")}`
}

function mockJwtServiceFor(address: string): jest.Mocked<JwtService> {
	return {
		signWalletToken: jest.fn().mockReturnValue("mock-token"),
		signRefreshToken: jest.fn().mockReturnValue("mock-refresh-token"),
		issueTokenPair: jest.fn().mockReturnValue({
			accessToken: "mock-token",
			refreshToken: "mock-refresh-token",
		}),
		verifyWalletToken: jest.fn().mockResolvedValue({ sub: address, jti: "jti" }),
		verifyRefreshToken: jest
			.fn()
			.mockResolvedValue({ sub: address, jti: "jti" }),
		rotateRefreshToken: jest.fn().mockResolvedValue({
			accessToken: "mock-token",
			refreshToken: "mock-refresh-token",
			sub: address,
		}),
		revokeToken: jest.fn().mockResolvedValue(undefined),
	}
}

function buildApp(learnerAddress: string) {
	const app = express()
	app.use(express.json())
	app.use("/api", createRelayRouter(mockJwtServiceFor(learnerAddress)))
	return app
}

beforeEach(() => {
	jest.clearAllMocks()
})

describe("POST /api/relay/fee-bump", () => {
	it("requires authentication", async () => {
		const app = buildApp(uniqueLearnerAddress())
		const res = await request(app)
			.post("/api/relay/fee-bump")
			.send({ innerTxXdr: "AAAA" })

		expect(res.status).toBe(401)
		expect(submitFeeBump).not.toHaveBeenCalled()
	})

	it("relays a valid request and returns the hash", async () => {
		;(submitFeeBump as jest.Mock).mockResolvedValue({ hash: "deadbeef" })
		const learner = uniqueLearnerAddress()
		const app = buildApp(learner)

		const res = await request(app)
			.post("/api/relay/fee-bump")
			.set("Authorization", "Bearer mock-token")
			.send({ innerTxXdr: "AAAA" })

		expect(res.status).toBe(200)
		expect(res.body).toEqual({ hash: "deadbeef" })
		expect(submitFeeBump).toHaveBeenCalledWith("AAAA", learner)
	})

	it("requires innerTxXdr", async () => {
		const app = buildApp(uniqueLearnerAddress())
		const res = await request(app)
			.post("/api/relay/fee-bump")
			.set("Authorization", "Bearer mock-token")
			.send({})

		expect(res.status).toBe(400)
		expect(submitFeeBump).not.toHaveBeenCalled()
	})

	it("propagates a relay rejection reason (e.g. a non-allowlisted operation)", async () => {
		;(submitFeeBump as jest.Mock).mockRejectedValue(
			new RelayRejection(
				"NOT_ALLOWLISTED",
				"operation withdraw on contract C... is not on the relayer allowlist",
			),
		)
		const app = buildApp(uniqueLearnerAddress())

		const res = await request(app)
			.post("/api/relay/fee-bump")
			.set("Authorization", "Bearer mock-token")
			.send({ innerTxXdr: "AAAA" })

		expect(res.status).toBe(400)
		expect(res.body.reason).toBe("NOT_ALLOWLISTED")
	})

	it("returns 503 when the relayer is not configured", async () => {
		;(submitFeeBump as jest.Mock).mockRejectedValue(
			new RelayRejection(
				"RELAYER_NOT_CONFIGURED",
				"SPONSOR_SECRET not configured — cannot relay transactions",
			),
		)
		const app = buildApp(uniqueLearnerAddress())

		const res = await request(app)
			.post("/api/relay/fee-bump")
			.set("Authorization", "Bearer mock-token")
			.send({ innerTxXdr: "AAAA" })

		expect(res.status).toBe(503)
	})

	it("enforces a per-account rate limit (30/hour) and returns 429 with Retry-After", async () => {
		;(submitFeeBump as jest.Mock).mockResolvedValue({ hash: "deadbeef" })
		const app = buildApp(uniqueLearnerAddress())

		for (let i = 0; i < 30; i++) {
			const res = await request(app)
				.post("/api/relay/fee-bump")
				.set("Authorization", "Bearer mock-token")
				.send({ innerTxXdr: "AAAA" })
			expect(res.status).toBe(200)
		}

		const blocked = await request(app)
			.post("/api/relay/fee-bump")
			.set("Authorization", "Bearer mock-token")
			.send({ innerTxXdr: "AAAA" })

		expect(blocked.status).toBe(429)
		expect(blocked.headers).toHaveProperty("retry-after")
	})

	it("tracks separate rate-limit buckets per learner account", async () => {
		;(submitFeeBump as jest.Mock).mockResolvedValue({ hash: "deadbeef" })
		const appA = buildApp(uniqueLearnerAddress())

		for (let i = 0; i < 30; i++) {
			await request(appA)
				.post("/api/relay/fee-bump")
				.set("Authorization", "Bearer mock-token")
				.send({ innerTxXdr: "AAAA" })
		}
		const blockedA = await request(appA)
			.post("/api/relay/fee-bump")
			.set("Authorization", "Bearer mock-token")
			.send({ innerTxXdr: "AAAA" })
		expect(blockedA.status).toBe(429)

		// A different learner (fresh key/bucket) is unaffected.
		const appB = buildApp(uniqueLearnerAddress())
		const freshB = await request(appB)
			.post("/api/relay/fee-bump")
			.set("Authorization", "Bearer mock-token")
			.send({ innerTxXdr: "AAAA" })
		expect(freshB.status).toBe(200)
	})
})
