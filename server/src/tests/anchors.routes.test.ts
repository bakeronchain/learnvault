/**
 * Integration tests for the anchor cash-out routes (#1053).
 * anchor.service and the DB store are mocked here — this file exercises
 * routing, auth gating, request validation, and error-status mapping. The
 * service's own HTTP/allowlist logic is covered directly in
 * anchor.service.test.ts against a mocked anchor.
 *
 * writeLimiter/generalLimiter/nonceRateLimiter are shared, IP-keyed
 * singletons (same gotcha documented in wallet.routes.test.ts /
 * relay.routes.test.ts) — mocked away here since this file makes more
 * requests across its cases than a real limiter would allow.
 */

jest.mock("../middleware/rate-limit.middleware", () => ({
	generalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
	writeLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}))
jest.mock("../middleware/nonce-rate-limit.middleware", () => ({
	nonceRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

jest.mock("../services/anchor.service", () => {
	const actual = jest.requireActual("../services/anchor.service")
	return {
		...actual,
		listAnchorsForCountry: jest.fn(),
		getAnchorAuthChallenge: jest.fn(),
		submitAnchorAuth: jest.fn(),
		getIndicativePrice: jest.fn(),
		getFirmQuote: jest.fn(),
		initiateWithdrawal: jest.fn(),
		reconcileWithdrawal: jest.fn(),
		listWithdrawalsForLearner: jest.fn(),
	}
})

jest.mock("../db/anchor-withdrawal-store", () => ({
	anchorWithdrawalStore: {
		listWithdrawalsForLearner: jest.fn(),
	},
}))

import express from "express"
import request from "supertest"
import { createAnchorsRouter } from "../routes/anchors.routes"
import { type JwtService } from "../services/jwt.service"
import {
	AnchorNotAllowlistedError,
	getAnchorAuthChallenge,
	getFirmQuote,
	getIndicativePrice,
	initiateWithdrawal,
	listAnchorsForCountry,
	listWithdrawalsForLearner,
	reconcileWithdrawal,
	submitAnchorAuth,
} from "../services/anchor.service"
import { anchorWithdrawalStore } from "../db/anchor-withdrawal-store"

const LEARNER = "GLEARNER00000000000000000000000000000000000000000000000"

function mockJwtService(): jest.Mocked<JwtService> {
	return {
		signWalletToken: jest.fn().mockReturnValue("mock-token"),
		signRefreshToken: jest.fn().mockReturnValue("mock-refresh-token"),
		issueTokenPair: jest.fn().mockReturnValue({
			accessToken: "mock-token",
			refreshToken: "mock-refresh-token",
		}),
		verifyWalletToken: jest
			.fn()
			.mockResolvedValue({ sub: LEARNER, jti: "jti" }),
		verifyRefreshToken: jest
			.fn()
			.mockResolvedValue({ sub: LEARNER, jti: "jti" }),
		rotateRefreshToken: jest.fn().mockResolvedValue({
			accessToken: "mock-token",
			refreshToken: "mock-refresh-token",
			sub: LEARNER,
		}),
		revokeToken: jest.fn().mockResolvedValue(undefined),
	}
}

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use("/api", createAnchorsRouter(mockJwtService()))
	return app
}

beforeEach(() => {
	jest.clearAllMocks()
})

describe("GET /api/anchors", () => {
	it("lists anchors, forwarding the country filter", async () => {
		;(listAnchorsForCountry as jest.Mock).mockResolvedValue([
			{ domain: "testanchor.stellar.org" },
		])
		const app = buildApp()

		const res = await request(app).get("/api/anchors?country=NG")

		expect(res.status).toBe(200)
		expect(res.body.anchors).toHaveLength(1)
		expect(listAnchorsForCountry).toHaveBeenCalledWith("NG")
	})
})

describe("GET /api/anchors/:domain/auth-challenge", () => {
	it("requires an account query parameter", async () => {
		const app = buildApp()
		const res = await request(app).get(
			"/api/anchors/testanchor.stellar.org/auth-challenge",
		)
		expect(res.status).toBe(400)
		expect(getAnchorAuthChallenge).not.toHaveBeenCalled()
	})

	it("returns the anchor's challenge", async () => {
		;(getAnchorAuthChallenge as jest.Mock).mockResolvedValue({
			transaction: "xdr",
			network_passphrase: "Test SDF Network",
		})
		const app = buildApp()

		const res = await request(app).get(
			`/api/anchors/testanchor.stellar.org/auth-challenge?account=${LEARNER}`,
		)

		expect(res.status).toBe(200)
		expect(res.body).toEqual({
			transaction: "xdr",
			network_passphrase: "Test SDF Network",
		})
	})

	it("maps AnchorNotAllowlistedError to 404", async () => {
		;(getAnchorAuthChallenge as jest.Mock).mockRejectedValue(
			new AnchorNotAllowlistedError("evil.example"),
		)
		const app = buildApp()

		const res = await request(app).get(
			`/api/anchors/evil.example/auth-challenge?account=${LEARNER}`,
		)

		expect(res.status).toBe(404)
	})
})

describe("POST /api/anchors/:domain/auth", () => {
	it("requires signedTransactionXdr", async () => {
		const app = buildApp()
		const res = await request(app)
			.post("/api/anchors/testanchor.stellar.org/auth")
			.send({})
		expect(res.status).toBe(400)
		expect(submitAnchorAuth).not.toHaveBeenCalled()
	})

	it("submits the signed challenge and returns the anchor's token", async () => {
		;(submitAnchorAuth as jest.Mock).mockResolvedValue({ token: "anchor-jwt" })
		const app = buildApp()

		const res = await request(app)
			.post("/api/anchors/testanchor.stellar.org/auth")
			.send({ signedTransactionXdr: "signed-xdr" })

		expect(res.status).toBe(200)
		expect(res.body).toEqual({ token: "anchor-jwt" })
		expect(submitAnchorAuth).toHaveBeenCalledWith(
			"testanchor.stellar.org",
			"signed-xdr",
		)
	})
})

describe("GET /api/anchors/:domain/quote", () => {
	it("requires sell, buy, and amount", async () => {
		const app = buildApp()
		const res = await request(app).get(
			"/api/anchors/testanchor.stellar.org/quote?sell=USDC",
		)
		expect(res.status).toBe(400)
	})

	it("returns an indicative price when no Authorization header is present", async () => {
		;(getIndicativePrice as jest.Mock).mockResolvedValue({
			total_price: "1500",
			price: "1500",
			sell_amount: "50",
			buy_amount: "75000",
			fee: { total: "0.5", asset: "USDC" },
		})
		const app = buildApp()

		const res = await request(app).get(
			"/api/anchors/testanchor.stellar.org/quote?sell=USDC&buy=NGN&amount=50",
		)

		expect(res.status).toBe(200)
		expect(res.body.firm).toBe(false)
		expect(getFirmQuote).not.toHaveBeenCalled()
	})

	it("returns a firm quote when an anchor token is supplied", async () => {
		;(getFirmQuote as jest.Mock).mockResolvedValue({
			id: "quote-1",
			expires_at: "2099-01-01T00:00:00Z",
			total_price: "1500",
			price: "1500",
			sell_amount: "50",
			buy_amount: "75000",
			sell_asset: "USDC",
			buy_asset: "NGN",
			fee: { total: "0.5", asset: "USDC" },
		})
		const app = buildApp()

		const res = await request(app)
			.get("/api/anchors/testanchor.stellar.org/quote?sell=USDC&buy=NGN&amount=50")
			.set("Authorization", "Bearer anchor-jwt")

		expect(res.status).toBe(200)
		expect(res.body.firm).toBe(true)
		expect(res.body.id).toBe("quote-1")
		expect(res.body.expired).toBe(false)
		expect(getIndicativePrice).not.toHaveBeenCalled()
		expect(getFirmQuote).toHaveBeenCalledWith(
			"testanchor.stellar.org",
			{ sellAsset: "USDC", buyAsset: "NGN", sellAmount: "50" },
			"anchor-jwt",
		)
	})
})

describe("POST /api/anchors/:domain/withdraw", () => {
	it("requires authentication", async () => {
		const app = buildApp()
		const res = await request(app)
			.post("/api/anchors/testanchor.stellar.org/withdraw")
			.send({
				assetCode: "USDC",
				assetOut: "NGN",
				amount: "50",
				anchorToken: "anchor-jwt",
			})
		expect(res.status).toBe(401)
		expect(initiateWithdrawal).not.toHaveBeenCalled()
	})

	it("validates required fields", async () => {
		const app = buildApp()
		const res = await request(app)
			.post("/api/anchors/testanchor.stellar.org/withdraw")
			.set("Authorization", "Bearer mock-token")
			.send({ assetCode: "USDC" })
		expect(res.status).toBe(400)
		expect(initiateWithdrawal).not.toHaveBeenCalled()
	})

	it("initiates the withdrawal for the authenticated learner", async () => {
		;(initiateWithdrawal as jest.Mock).mockResolvedValue({
			id: 1,
			transactionId: "anchor-tx-1",
			url: "https://testanchor.stellar.org/webapp?token=abc",
		})
		const app = buildApp()

		const res = await request(app)
			.post("/api/anchors/testanchor.stellar.org/withdraw")
			.set("Authorization", "Bearer mock-token")
			.send({
				assetCode: "USDC",
				assetOut: "NGN",
				amount: "50",
				anchorToken: "anchor-jwt",
			})

		expect(res.status).toBe(201)
		expect(initiateWithdrawal).toHaveBeenCalledWith(
			"testanchor.stellar.org",
			expect.objectContaining({ learnerAddr: LEARNER, amount: "50" }),
		)
	})
})

describe("POST /api/anchors/:domain/withdrawals/:transactionId/reconcile", () => {
	it("requires authentication", async () => {
		const app = buildApp()
		const res = await request(app)
			.post(
				"/api/anchors/testanchor.stellar.org/withdrawals/anchor-tx-1/reconcile",
			)
			.send({ anchorToken: "anchor-jwt" })
		expect(res.status).toBe(401)
	})

	it("rejects a withdrawal that does not belong to the authenticated learner", async () => {
		;(anchorWithdrawalStore.listWithdrawalsForLearner as jest.Mock).mockResolvedValue(
			[],
		)
		const app = buildApp()

		const res = await request(app)
			.post(
				"/api/anchors/testanchor.stellar.org/withdrawals/anchor-tx-1/reconcile",
			)
			.set("Authorization", "Bearer mock-token")
			.send({ anchorToken: "anchor-jwt" })

		expect(res.status).toBe(404)
		expect(reconcileWithdrawal).not.toHaveBeenCalled()
	})

	it("reconciles a withdrawal the learner owns", async () => {
		;(anchorWithdrawalStore.listWithdrawalsForLearner as jest.Mock).mockResolvedValue(
			[
				{
					anchor_domain: "testanchor.stellar.org",
					transaction_id: "anchor-tx-1",
					status: "pending_anchor",
				},
			],
		)
		;(reconcileWithdrawal as jest.Mock).mockResolvedValue({
			id: 1,
			status: "completed",
		})
		const app = buildApp()

		const res = await request(app)
			.post(
				"/api/anchors/testanchor.stellar.org/withdrawals/anchor-tx-1/reconcile",
			)
			.set("Authorization", "Bearer mock-token")
			.send({ anchorToken: "anchor-jwt" })

		expect(res.status).toBe(200)
		expect(res.body.withdrawal).toEqual({ id: 1, status: "completed" })
		expect(reconcileWithdrawal).toHaveBeenCalledWith(
			"testanchor.stellar.org",
			"anchor-tx-1",
			"anchor-jwt",
		)
	})
})

describe("GET /api/anchors/withdrawals", () => {
	it("requires authentication", async () => {
		const app = buildApp()
		const res = await request(app).get("/api/anchors/withdrawals")
		expect(res.status).toBe(401)
	})

	it("returns the authenticated learner's withdrawal history", async () => {
		;(listWithdrawalsForLearner as jest.Mock).mockResolvedValue([
			{ id: 1, status: "completed" },
		])
		const app = buildApp()

		const res = await request(app)
			.get("/api/anchors/withdrawals")
			.set("Authorization", "Bearer mock-token")

		expect(res.status).toBe(200)
		expect(res.body.withdrawals).toEqual([{ id: 1, status: "completed" }])
		expect(listWithdrawalsForLearner).toHaveBeenCalledWith(LEARNER)
	})
})
