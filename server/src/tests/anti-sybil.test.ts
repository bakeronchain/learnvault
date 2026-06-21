// ---------------------------------------------------------------------------
// Anti-sybil unit tests
// All external dependencies (db pool, email service, Twilio, Smile Identity)
// are mocked so these tests are hermetic and require no network / DB access.
// ---------------------------------------------------------------------------

// --- Mock pool ---
const poolQueryMock = jest.fn()
jest.mock("../db", () => ({ pool: { query: poolQueryMock } }))

// --- Mock email service ---
const sendNotificationMock = jest.fn()
jest.mock("../services/email.service", () => ({
	EmailService: jest.fn().mockImplementation(() => ({
		sendNotification: sendNotificationMock,
	})),
}))

// --- Mock Twilio OTP service ---
const sendOtpMock = jest.fn()
const verifyOtpMock = jest.fn()
jest.mock("../services/twilio-otp.service", () => ({
	sendOtp: sendOtpMock,
	verifyOtp: verifyOtpMock,
}))

// --- Mock Smile Identity service ---
const submitDocumentMock = jest.fn()
const submitBiometricMock = jest.fn()
jest.mock("../services/smile-identity.service", () => ({
	submitDocumentVerification: submitDocumentMock,
	submitBiometricVerification: submitBiometricMock,
}))

import {
	generateEmailToken,
	verifyEmailToken,
} from "../services/email-verification.service"
import {
	initiateVerification,
	confirmVerification,
	emailVerificationCallback,
	getVerificationStatus,
	getSybilScore,
	kycWebhook,
} from "../controllers/anti-sybil.controller"
import type { AuthRequest } from "../middleware/auth.middleware"
import type { Request, Response } from "express"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WALLET = "GABC1234TESTWALLETADDRESS"

function makeAuthReq(
	body: Record<string, unknown> = {},
	query: Record<string, string> = {},
	headers: Record<string, string> = {},
): AuthRequest {
	return {
		user: { address: WALLET },
		body,
		query,
		headers,
	} as unknown as AuthRequest
}

function makeRes(): { res: Response; json: jest.Mock; status: jest.Mock; redirect: jest.Mock } {
	const json = jest.fn()
	const redirect = jest.fn()
	const status = jest.fn().mockReturnValue({ json })
	const res = { json, status, redirect } as unknown as Response
	return { res, json, status, redirect }
}

// ---------------------------------------------------------------------------
// Email token service
// ---------------------------------------------------------------------------

describe("email-verification.service", () => {
	const EMAIL = "alice@example.com"

	beforeEach(() => {
		process.env.EMAIL_VERIFICATION_SECRET = "test-secret-32-chars-long-enough!!"
	})

	it("generates a token that round-trips correctly", () => {
		const token = generateEmailToken(WALLET, EMAIL)
		const payload = verifyEmailToken(token)

		expect(payload).not.toBeNull()
		expect(payload?.walletAddress).toBe(WALLET)
		expect(payload?.email).toBe(EMAIL)
	})

	it("returns null for a tampered signature", () => {
		const token = generateEmailToken(WALLET, EMAIL)
		const tampered = token.slice(0, -4) + "XXXX"
		expect(verifyEmailToken(tampered)).toBeNull()
	})

	it("returns null for an expired token", () => {
		// Generate token with exp already in the past by manipulating the payload
		const past = Date.now() - 1000
		const payload = { walletAddress: WALLET, email: EMAIL, exp: past }
		const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
		const crypto = require("node:crypto") as typeof import("node:crypto")
		const sig = crypto
			.createHmac("sha256", process.env.EMAIL_VERIFICATION_SECRET!)
			.update(encoded)
			.digest("base64url")
		const expiredToken = `${encoded}.${sig}`
		expect(verifyEmailToken(expiredToken)).toBeNull()
	})

	it("returns null for a malformed token (no dot separator)", () => {
		expect(verifyEmailToken("nodothere")).toBeNull()
	})
})

// ---------------------------------------------------------------------------
// initiateVerification
// ---------------------------------------------------------------------------

describe("initiateVerification", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		poolQueryMock.mockResolvedValue({ rows: [] })
		process.env.EMAIL_VERIFICATION_SECRET = "test-secret-32-chars-long-enough!!"
	})

	it("returns 401 when user is not authenticated", async () => {
		const req = { user: undefined, body: { method: "email" }, query: {}, headers: {} } as unknown as AuthRequest
		const { res, status } = makeRes()
		await initiateVerification(req, res)
		expect(status).toHaveBeenCalledWith(401)
	})

	it("returns 400 for an invalid method", async () => {
		const { res, status } = makeRes()
		await initiateVerification(makeAuthReq({ method: "carrier_pigeon" }), res)
		expect(status).toHaveBeenCalledWith(400)
	})

	describe("email", () => {
		it("sends verification email and upserts pending record", async () => {
			sendNotificationMock.mockResolvedValue(true)
			const { res, json } = makeRes()

			await initiateVerification(
				makeAuthReq({ method: "email", data: { email: "alice@example.com" } }),
				res,
			)

			expect(sendNotificationMock).toHaveBeenCalledTimes(1)
			expect(poolQueryMock).toHaveBeenCalledWith(
				expect.stringContaining("INSERT INTO identity_verifications"),
				expect.arrayContaining([WALLET, "email", "pending"]),
			)
			expect(json).toHaveBeenCalledWith(
				expect.objectContaining({ message: expect.stringContaining("email") }),
			)
		})

		it("returns 400 for missing email", async () => {
			const { res, status } = makeRes()
			await initiateVerification(makeAuthReq({ method: "email", data: {} }), res)
			expect(status).toHaveBeenCalledWith(400)
		})

		it("returns 400 for malformed email", async () => {
			const { res, status } = makeRes()
			await initiateVerification(
				makeAuthReq({ method: "email", data: { email: "not-an-email" } }),
				res,
			)
			expect(status).toHaveBeenCalledWith(400)
		})

		it("returns 500 when email dispatch throws", async () => {
			sendNotificationMock.mockResolvedValue(false)
			const { res, status } = makeRes()
			await initiateVerification(
				makeAuthReq({ method: "email", data: { email: "alice@example.com" } }),
				res,
			)
			expect(status).toHaveBeenCalledWith(500)
		})
	})

	describe("phone", () => {
		it("calls Twilio and upserts pending record", async () => {
			sendOtpMock.mockResolvedValue(undefined)
			const { res, json } = makeRes()

			await initiateVerification(
				makeAuthReq({ method: "phone", data: { phone: "+2341234567890" } }),
				res,
			)

			expect(sendOtpMock).toHaveBeenCalledWith("+2341234567890")
			expect(poolQueryMock).toHaveBeenCalledWith(
				expect.stringContaining("INSERT INTO identity_verifications"),
				expect.arrayContaining([WALLET, "phone", "pending"]),
			)
			expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }))
		})

		it("returns 400 for missing phone", async () => {
			const { res, status } = makeRes()
			await initiateVerification(makeAuthReq({ method: "phone", data: {} }), res)
			expect(status).toHaveBeenCalledWith(400)
		})

		it("returns 400 for phone not in E.164 format", async () => {
			const { res, status } = makeRes()
			await initiateVerification(
				makeAuthReq({ method: "phone", data: { phone: "08012345678" } }),
				res,
			)
			expect(status).toHaveBeenCalledWith(400)
		})

		it("returns 500 when Twilio throws", async () => {
			sendOtpMock.mockRejectedValue(new Error("Twilio down"))
			const { res, status } = makeRes()
			await initiateVerification(
				makeAuthReq({ method: "phone", data: { phone: "+2341234567890" } }),
				res,
			)
			expect(status).toHaveBeenCalledWith(500)
		})
	})

	describe("government_id", () => {
		const govData = {
			country: "NG",
			id_type: "PASSPORT",
			id_number: "A12345678",
			first_name: "Ada",
			last_name: "Lovelace",
			dob: "1990-01-01",
		}

		it("calls Smile Identity and upserts pending record with job_id", async () => {
			submitDocumentMock.mockResolvedValue("smile-job-id-123")
			const { res, json } = makeRes()

			await initiateVerification(
				makeAuthReq({ method: "government_id", data: govData }),
				res,
			)

			expect(submitDocumentMock).toHaveBeenCalledTimes(1)
			expect(poolQueryMock).toHaveBeenCalledWith(
				expect.stringContaining("INSERT INTO identity_verifications"),
				expect.arrayContaining([WALLET, "government_id", "pending", "smile-job-id-123"]),
			)
			expect(json).toHaveBeenCalledWith(
				expect.objectContaining({ jobId: "smile-job-id-123" }),
			)
		})

		it("returns 400 when required fields are missing", async () => {
			const { res, status } = makeRes()
			await initiateVerification(
				makeAuthReq({ method: "government_id", data: { country: "NG" } }),
				res,
			)
			expect(status).toHaveBeenCalledWith(400)
		})
	})

	describe("biometric", () => {
		it("calls Smile Identity and upserts pending record", async () => {
			submitBiometricMock.mockResolvedValue("smile-bio-job-456")
			const { res, json } = makeRes()

			await initiateVerification(
				makeAuthReq({
					method: "biometric",
					data: { selfie_base64: "base64data==", country: "NG" },
				}),
				res,
			)

			expect(submitBiometricMock).toHaveBeenCalledTimes(1)
			expect(json).toHaveBeenCalledWith(
				expect.objectContaining({ jobId: "smile-bio-job-456" }),
			)
		})

		it("returns 400 when selfie_base64 is missing", async () => {
			const { res, status } = makeRes()
			await initiateVerification(
				makeAuthReq({ method: "biometric", data: { country: "NG" } }),
				res,
			)
			expect(status).toHaveBeenCalledWith(400)
		})
	})
})

// ---------------------------------------------------------------------------
// confirmVerification
// ---------------------------------------------------------------------------

describe("confirmVerification", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		poolQueryMock.mockResolvedValue({ rows: [] })
		process.env.EMAIL_VERIFICATION_SECRET = "test-secret-32-chars-long-enough!!"
	})

	it("returns 401 when unauthenticated", async () => {
		const req = { user: undefined, body: { method: "email" }, query: {}, headers: {} } as unknown as AuthRequest
		const { res, status } = makeRes()
		await confirmVerification(req, res)
		expect(status).toHaveBeenCalledWith(401)
	})

	describe("email token", () => {
		it("verifies a valid token and marks the record verified", async () => {
			const token = generateEmailToken(WALLET, "alice@example.com")
			const { res, json } = makeRes()

			await confirmVerification(
				makeAuthReq({ method: "email", token }),
				res,
			)

			expect(poolQueryMock).toHaveBeenCalledWith(
				expect.stringContaining("INSERT INTO identity_verifications"),
				expect.arrayContaining([WALLET, "email", "verified"]),
			)
			expect(json).toHaveBeenCalledWith(
				expect.objectContaining({ success: true, method: "email" }),
			)
		})

		it("rejects a token for a different wallet", async () => {
			const token = generateEmailToken("GDIFFERENTWALLETADDRESS", "eve@example.com")
			const { res, status } = makeRes()

			await confirmVerification(makeAuthReq({ method: "email", token }), res)
			expect(status).toHaveBeenCalledWith(400)
		})

		it("rejects a tampered token", async () => {
			const token = generateEmailToken(WALLET, "alice@example.com")
			const { res, status } = makeRes()

			await confirmVerification(
				makeAuthReq({ method: "email", token: token.slice(0, -4) + "XXXX" }),
				res,
			)
			expect(status).toHaveBeenCalledWith(400)
		})
	})

	describe("phone OTP", () => {
		it("verifies a valid OTP and marks the record verified", async () => {
			verifyOtpMock.mockResolvedValue(true)
			const { res, json } = makeRes()

			await confirmVerification(
				makeAuthReq({ method: "phone", phone: "+2341234567890", code: "123456" }),
				res,
			)

			expect(verifyOtpMock).toHaveBeenCalledWith("+2341234567890", "123456")
			expect(json).toHaveBeenCalledWith(
				expect.objectContaining({ success: true, method: "phone" }),
			)
		})

		it("returns 400 for an incorrect OTP code", async () => {
			verifyOtpMock.mockResolvedValue(false)
			const { res, status } = makeRes()

			await confirmVerification(
				makeAuthReq({ method: "phone", phone: "+2341234567890", code: "000000" }),
				res,
			)
			expect(status).toHaveBeenCalledWith(400)
		})

		it("returns 500 when Twilio throws", async () => {
			verifyOtpMock.mockRejectedValue(new Error("Twilio error"))
			const { res, status } = makeRes()

			await confirmVerification(
				makeAuthReq({ method: "phone", phone: "+2341234567890", code: "123456" }),
				res,
			)
			expect(status).toHaveBeenCalledWith(500)
		})
	})

	describe("government_id / biometric (async)", () => {
		it("returns 400 because these are confirmed via webhook", async () => {
			const { res, status } = makeRes()
			await confirmVerification(
				makeAuthReq({ method: "government_id" }),
				res,
			)
			expect(status).toHaveBeenCalledWith(400)
		})
	})
})

// ---------------------------------------------------------------------------
// emailVerificationCallback
// ---------------------------------------------------------------------------

describe("emailVerificationCallback", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		poolQueryMock.mockResolvedValue({ rows: [] })
		process.env.EMAIL_VERIFICATION_SECRET = "test-secret-32-chars-long-enough!!"
		process.env.FRONTEND_URL = "http://localhost:5173"
	})

	it("redirects to success URL on a valid token", async () => {
		const token = generateEmailToken(WALLET, "alice@example.com")
		const req = { query: { token }, headers: {} } as unknown as Request
		const { res, redirect } = makeRes()

		await emailVerificationCallback(req, res)

		expect(poolQueryMock).toHaveBeenCalledWith(
			expect.stringContaining("INSERT INTO identity_verifications"),
			expect.arrayContaining([WALLET, "email", "verified"]),
		)
		expect(redirect).toHaveBeenCalledWith(
			expect.stringContaining("success=true"),
		)
	})

	it("redirects with error=missing_token when no token provided", async () => {
		const req = { query: {}, headers: {} } as unknown as Request
		const { res, redirect } = makeRes()

		await emailVerificationCallback(req, res)
		expect(redirect).toHaveBeenCalledWith(expect.stringContaining("missing_token"))
	})

	it("redirects with error=invalid_token for a tampered token", async () => {
		const req = { query: { token: "invalid.token" }, headers: {} } as unknown as Request
		const { res, redirect } = makeRes()

		await emailVerificationCallback(req, res)
		expect(redirect).toHaveBeenCalledWith(expect.stringContaining("invalid_token"))
	})
})

// ---------------------------------------------------------------------------
// getVerificationStatus
// ---------------------------------------------------------------------------

describe("getVerificationStatus", () => {
	beforeEach(() => jest.clearAllMocks())

	it("returns all verification rows for the wallet", async () => {
		poolQueryMock.mockResolvedValue({
			rows: [
				{ method: "email", status: "verified", verified_at: new Date().toISOString(), expires_at: null, created_at: new Date().toISOString() },
				{ method: "phone", status: "pending", verified_at: null, expires_at: new Date().toISOString(), created_at: new Date().toISOString() },
			],
		})
		const { res, json } = makeRes()
		await getVerificationStatus(makeAuthReq(), res)

		expect(json).toHaveBeenCalledWith(
			expect.objectContaining({
				walletAddress: WALLET,
				verifications: expect.arrayContaining([
					expect.objectContaining({ method: "email", status: "verified" }),
					expect.objectContaining({ method: "phone", status: "pending" }),
				]),
				allVerified: false,
			}),
		)
	})

	it("returns 401 when unauthenticated", async () => {
		const req = { user: undefined, body: {}, query: {}, headers: {} } as unknown as AuthRequest
		const { res, status } = makeRes()
		await getVerificationStatus(req, res)
		expect(status).toHaveBeenCalledWith(401)
	})
})

// ---------------------------------------------------------------------------
// getSybilScore
// ---------------------------------------------------------------------------

describe("getSybilScore", () => {
	beforeEach(() => jest.clearAllMocks())

	it("returns score=0 and riskLevel=high when no verifications exist", async () => {
		poolQueryMock.mockResolvedValue({ rows: [] })
		const { res, json } = makeRes()
		await getSybilScore(makeAuthReq(), res)

		expect(json).toHaveBeenCalledWith(
			expect.objectContaining({
				score: 0,
				riskLevel: "high",
				factors: expect.arrayContaining([
					"missing_email_verification",
					"missing_phone_verification",
					"missing_government_id_verification",
					"missing_biometric_verification",
				]),
			}),
		)
	})

	it("returns score=100 and riskLevel=low when all methods are verified", async () => {
		poolQueryMock.mockResolvedValue({
			rows: [
				{ method: "email" },
				{ method: "phone" },
				{ method: "government_id" },
				{ method: "biometric" },
			],
		})
		const { res, json } = makeRes()
		await getSybilScore(makeAuthReq(), res)

		expect(json).toHaveBeenCalledWith(
			expect.objectContaining({ score: 100, riskLevel: "low", factors: [] }),
		)
	})

	it("returns medium risk when only email and phone are verified", async () => {
		poolQueryMock.mockResolvedValue({
			rows: [{ method: "email" }, { method: "phone" }],
		})
		const { res, json } = makeRes()
		await getSybilScore(makeAuthReq(), res)

		const call = (json.mock.calls[0] as [{ score: number; riskLevel: string }])[0]
		expect(call.score).toBe(40)
		expect(call.riskLevel).toBe("medium")
	})
})

// ---------------------------------------------------------------------------
// kycWebhook
// ---------------------------------------------------------------------------

describe("kycWebhook", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		poolQueryMock.mockResolvedValue({ rows: [], rowCount: 1 })
		delete process.env.SMILE_IDENTITY_WEBHOOK_SECRET
	})

	it("marks verification as verified on ResultCode 1220", async () => {
		const body = JSON.stringify({ job_id: "job-abc", result: { ResultCode: "1220" } })
		const req = {
			body,
			headers: {},
		} as unknown as Request
		const { res, json } = makeRes()

		await kycWebhook(req, res)

		expect(poolQueryMock).toHaveBeenCalledWith(
			expect.stringContaining("UPDATE identity_verifications"),
			expect.arrayContaining(["verified", "job-abc"]),
		)
		expect(json).toHaveBeenCalledWith({ received: true })
	})

	it("marks verification as failed on a non-1220 result code", async () => {
		const body = JSON.stringify({ job_id: "job-abc", result: { ResultCode: "1221" } })
		const req = { body, headers: {} } as unknown as Request
		const { res, json } = makeRes()

		await kycWebhook(req, res)

		expect(poolQueryMock).toHaveBeenCalledWith(
			expect.any(String),
			expect.arrayContaining(["failed"]),
		)
		expect(json).toHaveBeenCalledWith({ received: true })
	})

	it("returns 400 for a malformed payload", async () => {
		const body = JSON.stringify({ wrong_field: "value" })
		const req = { body, headers: {} } as unknown as Request
		const { res, status } = makeRes()

		await kycWebhook(req, res)
		expect(status).toHaveBeenCalledWith(400)
	})

	it("rejects requests with a wrong HMAC signature when secret is configured", async () => {
		process.env.SMILE_IDENTITY_WEBHOOK_SECRET = "correct-secret"
		const body = JSON.stringify({ job_id: "j1", result: { ResultCode: "1220" } })
		const req = {
			body,
			headers: { "x-smile-signature": "wrong-sig" },
		} as unknown as Request
		const { res, status } = makeRes()

		await kycWebhook(req, res)
		expect(status).toHaveBeenCalledWith(401)
	})
})
