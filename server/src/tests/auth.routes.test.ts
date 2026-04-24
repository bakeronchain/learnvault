import express from "express"
import request from "supertest"
import { createAuthRouter } from "../routes/auth.routes"
import { type AuthService } from "../services/auth.service"

const mockAuthService: jest.Mocked<AuthService> = {
	getOrCreateNonce: jest.fn(),
	verifyAndIssueToken: jest.fn(),
	createChallenge: jest.fn(),
	verifySignedTransaction: jest.fn(),
	logout: jest.fn(),
}

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use("/api/auth", createAuthRouter(mockAuthService))
	return app
}

describe("Auth Routes", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe("GET /api/auth/challenge", () => {
		it("returns a valid challenge for a given address", async () => {
			const mockChallenge = {
				transaction: "mock_xdr",
				networkPassphrase: "Test SDF Network ; September 2015",
			}
			mockAuthService.createChallenge.mockResolvedValue(mockChallenge)

			const res = await request(buildApp())
				.get("/api/auth/challenge")
				.query({ address: "GABC" })

			expect(res.status).toBe(200)
			expect(res.body).toEqual(mockChallenge)
			expect(mockAuthService.createChallenge).toHaveBeenCalledWith("GABC")
		})

		it("returns 400 if address is missing", async () => {
			const res = await request(buildApp()).get("/api/auth/challenge")
			expect(res.status).toBe(400)
			expect(res.body.error).toContain("Missing query parameter")
		})
	})

	describe("POST /api/auth/challenge/verify", () => {
		it("returns a token on successful verification", async () => {
			mockAuthService.verifySignedTransaction.mockResolvedValue("mock_jwt_token")

			const res = await request(buildApp())
				.post("/api/auth/challenge/verify")
				.send({ signed_transaction: "signed_xdr" })

			expect(res.status).toBe(200)
			expect(res.body.token).toBe("mock_jwt_token")
			expect(res.body.tokenType).toBe("Bearer")
		})

		it("returns 400 if signed_transaction is missing", async () => {
			const res = await request(buildApp())
				.post("/api/auth/challenge/verify")
				.send({})
			expect(res.status).toBe(400)
		})
	})

	describe("GET /api/auth/nonce", () => {
		it("returns a nonce for a given address", async () => {
			mockAuthService.getOrCreateNonce.mockResolvedValue({ nonce: "mock_nonce" })

			const res = await request(buildApp())
				.get("/api/auth/nonce")
				.query({ address: "GABC" })

			expect(res.status).toBe(200)
			expect(res.body.nonce).toBe("mock_nonce")
		})

		it("returns 400 if address is missing", async () => {
			const res = await request(buildApp()).get("/api/auth/nonce")
			expect(res.status).toBe(400)
		})
	})

	describe("POST /api/auth/verify", () => {
		it("returns a token for a valid signature", async () => {
			mockAuthService.verifyAndIssueToken.mockResolvedValue("mock_jwt_token")

			const res = await request(buildApp())
				.post("/api/auth/verify")
				.send({ address: "GABC", signature: "mock_sig" })

			expect(res.status).toBe(200)
			expect(res.body.token).toBe("mock_jwt_token")
		})

		it("returns 400 if fields are missing", async () => {
			const res = await request(buildApp()).post("/api/auth/verify").send({})
			expect(res.status).toBe(400)
		})
	})

	describe("POST /api/auth/logout", () => {
		it("revokes the token on logout", async () => {
			mockAuthService.logout.mockResolvedValue(undefined)

			const res = await request(buildApp())
				.post("/api/auth/logout")
				.set("Authorization", "Bearer mock_token")

			expect(res.status).toBe(200)
			expect(mockAuthService.logout).toHaveBeenCalledWith("mock_token")
		})

		it("returns 401 if Authorization header is missing", async () => {
			const res = await request(buildApp()).post("/api/auth/logout")
			expect(res.status).toBe(401)
		})
	})
})
