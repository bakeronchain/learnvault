/**
 * Integration tests for the passkey wallet deployment endpoint.
 * The Stellar SDK boundary lives in passkey-wallet.service.ts, which is
 * mocked here — this file only exercises routing/validation/response shape.
 */

jest.mock("../services/passkey-wallet.service", () => ({
	deployPasskeyWallet: jest.fn(),
}))

jest.mock("../services/passkey-signer.service", () => ({
	prepareAddSigner: jest.fn(),
	confirmAddSigner: jest.fn(),
}))

// authVerifyLimiter is a shared singleton (10 req/15min) — this file alone
// makes more requests than that across all its cases, so bypass it here and
// let rate-limit.test.ts cover the limiter's own behavior.
jest.mock("../middleware/rate-limit.middleware", () => ({
	authVerifyLimiter: (_req: unknown, _res: unknown, next: () => void): void =>
		next(),
}))

import express from "express"
import request from "supertest"
import { createWalletRouter } from "../routes/wallet.routes"
import { type JwtService } from "../services/jwt.service"
import {
	confirmAddSigner,
	prepareAddSigner,
} from "../services/passkey-signer.service"
import { deployPasskeyWallet } from "../services/passkey-wallet.service"

const OWN_ADDRESS = "CABCDEF1234567890"

const mockJwtService: jest.Mocked<JwtService> = {
	signWalletToken: jest.fn().mockReturnValue("mock-token"),
	signRefreshToken: jest.fn().mockReturnValue("mock-refresh-token"),
	issueTokenPair: jest.fn().mockReturnValue({
		accessToken: "mock-token",
		refreshToken: "mock-refresh-token",
	}),
	verifyWalletToken: jest
		.fn()
		.mockResolvedValue({ sub: OWN_ADDRESS, jti: "mock-jti" }),
	verifyRefreshToken: jest
		.fn()
		.mockResolvedValue({ sub: OWN_ADDRESS, jti: "mock-jti" }),
	rotateRefreshToken: jest.fn().mockResolvedValue({
		accessToken: "mock-token",
		refreshToken: "mock-refresh-token",
		sub: OWN_ADDRESS,
	}),
	revokeToken: jest.fn().mockResolvedValue(undefined),
}

function buildApp() {
	const app = express()
	app.use(express.json())
	app.use("/api", createWalletRouter(mockJwtService))
	return app
}

const VALID_ASSERTION = {
	credentialId: Buffer.from("device-2").toString("base64url"),
	authenticatorData: Buffer.from("auth-data").toString("base64url"),
	clientDataJSON: Buffer.from('{"type":"webauthn.get"}').toString("base64url"),
	signature: Buffer.from(new Array(64).fill(9)).toString("base64url"),
}

const VALID_BODY = {
	credentialId: Buffer.from("cred-123").toString("base64url"),
	publicKey: Buffer.from([0x04, ...new Array(64).fill(1)]).toString(
		"base64url",
	),
}

describe("POST /api/wallet/deploy", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("deploys a wallet and returns a session token", async () => {
		;(deployPasskeyWallet as jest.Mock).mockResolvedValue({
			contractAddress: "CABCDEF1234567890",
			txHash: "deadbeef",
		})

		const app = buildApp()
		const res = await request(app).post("/api/wallet/deploy").send(VALID_BODY)

		expect(res.status).toBe(201)
		expect(res.body).toEqual({
			walletAddress: "CABCDEF1234567890",
			token: "mock-token",
			refreshToken: "mock-refresh-token",
			tokenType: "Bearer",
			expiresIn: "24h",
		})
		expect(deployPasskeyWallet).toHaveBeenCalledWith({
			credentialId: VALID_BODY.credentialId,
			publicKey: VALID_BODY.publicKey,
			deviceLabel: undefined,
		})
		expect(mockJwtService.issueTokenPair).toHaveBeenCalledWith(
			"CABCDEF1234567890",
		)
	})

	it("passes deviceLabel through when provided", async () => {
		;(deployPasskeyWallet as jest.Mock).mockResolvedValue({
			contractAddress: "CABCDEF1234567890",
			txHash: "deadbeef",
		})

		const app = buildApp()
		await request(app)
			.post("/api/wallet/deploy")
			.send({ ...VALID_BODY, deviceLabel: "iPhone 15" })

		expect(deployPasskeyWallet).toHaveBeenCalledWith(
			expect.objectContaining({ deviceLabel: "iPhone 15" }),
		)
	})

	it("rejects a request missing credentialId", async () => {
		const app = buildApp()
		const res = await request(app)
			.post("/api/wallet/deploy")
			.send({ publicKey: VALID_BODY.publicKey })

		expect(res.status).toBe(400)
		expect(res.body.error).toMatch(/credentialId/)
		expect(deployPasskeyWallet).not.toHaveBeenCalled()
	})

	it("rejects a request missing publicKey", async () => {
		const app = buildApp()
		const res = await request(app)
			.post("/api/wallet/deploy")
			.send({ credentialId: VALID_BODY.credentialId })

		expect(res.status).toBe(400)
		expect(res.body.error).toMatch(/publicKey/)
		expect(deployPasskeyWallet).not.toHaveBeenCalled()
	})

	it("rejects a non-string deviceLabel", async () => {
		const app = buildApp()
		const res = await request(app)
			.post("/api/wallet/deploy")
			.send({ ...VALID_BODY, deviceLabel: 123 })

		expect(res.status).toBe(400)
		expect(res.body.error).toMatch(/deviceLabel/)
	})

	it("returns 400 when the service rejects malformed key material", async () => {
		;(deployPasskeyWallet as jest.Mock).mockRejectedValue(
			new Error("publicKey must be a 65-byte uncompressed SEC1 P-256 point"),
		)

		const app = buildApp()
		const res = await request(app).post("/api/wallet/deploy").send(VALID_BODY)

		expect(res.status).toBe(400)
	})

	it("returns 500 when deployment fails for infrastructure reasons", async () => {
		;(deployPasskeyWallet as jest.Mock).mockRejectedValue(
			new Error("Passkey wallet deployment failed: network timeout"),
		)

		const app = buildApp()
		const res = await request(app).post("/api/wallet/deploy").send(VALID_BODY)

		expect(res.status).toBe(500)
		expect(mockJwtService.issueTokenPair).not.toHaveBeenCalled()
	})
})

describe("POST /api/wallet/:address/signers/prepare", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("requires authentication", async () => {
		const app = buildApp()
		const res = await request(app)
			.post(`/api/wallet/${OWN_ADDRESS}/signers/prepare`)
			.send(VALID_BODY)

		expect(res.status).toBe(401)
		expect(prepareAddSigner).not.toHaveBeenCalled()
	})

	it("rejects preparing add_signer for a wallet the caller doesn't own", async () => {
		const app = buildApp()
		const res = await request(app)
			.post(`/api/wallet/SOMEONE_ELSE/signers/prepare`)
			.set("Authorization", "Bearer mock-token")
			.send(VALID_BODY)

		expect(res.status).toBe(403)
		expect(prepareAddSigner).not.toHaveBeenCalled()
	})

	it("returns the requestId and challenge for the caller's own wallet", async () => {
		;(prepareAddSigner as jest.Mock).mockResolvedValue({
			requestId: "req-1",
			challenge: "Y2hhbGxlbmdl",
		})

		const app = buildApp()
		const res = await request(app)
			.post(`/api/wallet/${OWN_ADDRESS}/signers/prepare`)
			.set("Authorization", "Bearer mock-token")
			.send(VALID_BODY)

		expect(res.status).toBe(200)
		expect(res.body).toEqual({ requestId: "req-1", challenge: "Y2hhbGxlbmdl" })
		expect(prepareAddSigner).toHaveBeenCalledWith(
			OWN_ADDRESS,
			VALID_BODY.credentialId,
			VALID_BODY.publicKey,
			undefined,
		)
	})

	it("rejects a request missing credentialId", async () => {
		const app = buildApp()
		const res = await request(app)
			.post(`/api/wallet/${OWN_ADDRESS}/signers/prepare`)
			.set("Authorization", "Bearer mock-token")
			.send({ publicKey: VALID_BODY.publicKey })

		expect(res.status).toBe(400)
		expect(prepareAddSigner).not.toHaveBeenCalled()
	})
})

describe("POST /api/wallet/:address/signers/confirm", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("requires authentication", async () => {
		const app = buildApp()
		const res = await request(app)
			.post(`/api/wallet/${OWN_ADDRESS}/signers/confirm`)
			.send({ requestId: "req-1", assertion: VALID_ASSERTION })

		expect(res.status).toBe(401)
		expect(confirmAddSigner).not.toHaveBeenCalled()
	})

	it("rejects confirming for a wallet the caller doesn't own", async () => {
		const app = buildApp()
		const res = await request(app)
			.post(`/api/wallet/SOMEONE_ELSE/signers/confirm`)
			.set("Authorization", "Bearer mock-token")
			.send({ requestId: "req-1", assertion: VALID_ASSERTION })

		expect(res.status).toBe(403)
		expect(confirmAddSigner).not.toHaveBeenCalled()
	})

	it("submits the assertion and returns the tx hash", async () => {
		;(confirmAddSigner as jest.Mock).mockResolvedValue({ txHash: "abc123" })

		const app = buildApp()
		const res = await request(app)
			.post(`/api/wallet/${OWN_ADDRESS}/signers/confirm`)
			.set("Authorization", "Bearer mock-token")
			.send({ requestId: "req-1", assertion: VALID_ASSERTION })

		expect(res.status).toBe(200)
		expect(res.body).toEqual({ txHash: "abc123" })
		expect(confirmAddSigner).toHaveBeenCalledWith("req-1", VALID_ASSERTION)
	})

	it("rejects a request missing the assertion", async () => {
		const app = buildApp()
		const res = await request(app)
			.post(`/api/wallet/${OWN_ADDRESS}/signers/confirm`)
			.set("Authorization", "Bearer mock-token")
			.send({ requestId: "req-1" })

		expect(res.status).toBe(400)
		expect(confirmAddSigner).not.toHaveBeenCalled()
	})

	it("returns 400 when the request has expired", async () => {
		;(confirmAddSigner as jest.Mock).mockRejectedValue(
			new Error("Request not found or expired — please try again"),
		)

		const app = buildApp()
		const res = await request(app)
			.post(`/api/wallet/${OWN_ADDRESS}/signers/confirm`)
			.set("Authorization", "Bearer mock-token")
			.send({ requestId: "stale", assertion: VALID_ASSERTION })

		expect(res.status).toBe(400)
	})
})
