import crypto from "node:crypto"
import { type Request, type Response } from "express"
import { pool } from "../db"
import { logger, maskAddress } from "../lib/logger"
import { type AuthRequest } from "../middleware/auth.middleware"
import {
	sendVerificationEmail,
	verifyEmailToken,
} from "../services/email-verification.service"
import { sendOtp, verifyOtp } from "../services/twilio-otp.service"
import {
	submitBiometricVerification,
	submitDocumentVerification,
} from "../services/smile-identity.service"

const log = logger.child({ module: "anti-sybil" })

type VerificationMethod = "email" | "phone" | "government_id" | "biometric"

const VALID_METHODS = new Set<VerificationMethod>([
	"email",
	"phone",
	"government_id",
	"biometric",
])

// Additive weights — each verified method contributes its weight to a 0-100 score
const METHOD_WEIGHTS: Record<VerificationMethod, number> = {
	email: 20,
	phone: 20,
	government_id: 35,
	biometric: 25,
}

function asNonEmptyString(value: unknown): string | null {
	if (typeof value !== "string") return null
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : null
}

function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// E.164 format: +<country_code><subscriber_number>
function isValidPhone(phone: string): boolean {
	return /^\+[1-9]\d{6,14}$/.test(phone)
}

/**
 * Upserts a verification record for the given wallet and method.
 * Re-initiating a verification overwrites the previous attempt via ON CONFLICT.
 */
async function upsertVerification(
	walletAddress: string,
	method: VerificationMethod,
	status: "pending" | "verified" | "failed",
	options: {
		providerRef?: string | null
		expiresAt?: Date | null
		verifiedAt?: Date | null
	} = {},
): Promise<void> {
	await pool.query(
		`INSERT INTO identity_verifications
		   (wallet_address, method, status, provider_ref, expires_at, verified_at)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (wallet_address, method)
		 DO UPDATE SET
		   status       = EXCLUDED.status,
		   provider_ref = EXCLUDED.provider_ref,
		   expires_at   = EXCLUDED.expires_at,
		   verified_at  = EXCLUDED.verified_at`,
		[
			walletAddress,
			method,
			status,
			options.providerRef ?? null,
			options.expiresAt ?? null,
			options.verifiedAt ?? null,
		],
	)
}

/**
 * Computes a 0–100 sybil trust score from the set of verified methods.
 * Score is additive: each completed verification contributes its weight.
 */
function computeSybilScore(verifiedMethods: Set<VerificationMethod>): {
	score: number
	riskLevel: "low" | "medium" | "high"
	factors: string[]
} {
	let score = 0
	const factors: string[] = []

	for (const method of Object.keys(METHOD_WEIGHTS) as VerificationMethod[]) {
		if (verifiedMethods.has(method)) {
			score += METHOD_WEIGHTS[method]
		} else {
			factors.push(`missing_${method}_verification`)
		}
	}

	const riskLevel: "low" | "medium" | "high" =
		score >= 75 ? "low" : score >= 40 ? "medium" : "high"

	return { score, riskLevel, factors }
}

// ---------------------------------------------------------------------------
// POST /api/identity/verify — initiate a verification
// ---------------------------------------------------------------------------

export async function initiateVerification(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const walletAddress = req.user?.address
	if (!walletAddress) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const method = asNonEmptyString(req.body?.method) as VerificationMethod | null
	if (!method || !VALID_METHODS.has(method)) {
		res.status(400).json({
			error: "method must be one of: email, phone, government_id, biometric",
		})
		return
	}

	const data: Record<string, unknown> = req.body?.data ?? {}

	try {
		switch (method) {
			case "email": {
				const email = asNonEmptyString(data.email)
				if (!email || !isValidEmail(email)) {
					res.status(400).json({ error: "A valid email address is required" })
					return
				}
				await sendVerificationEmail(walletAddress, email)
				await upsertVerification(walletAddress, "email", "pending", {
					expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
				})
				res.json({
					message: "Verification email sent. Check your inbox and click the link.",
				})
				break
			}

			case "phone": {
				const phone = asNonEmptyString(data.phone)
				if (!phone || !isValidPhone(phone)) {
					res.status(400).json({
						error:
							"A valid E.164 phone number is required (e.g. +2341234567890)",
					})
					return
				}
				await sendOtp(phone)
				await upsertVerification(walletAddress, "phone", "pending", {
					expiresAt: new Date(Date.now() + 10 * 60 * 1000),
				})
				res.json({ message: "OTP sent via SMS. Enter the code to confirm." })
				break
			}

			case "government_id": {
				const country = asNonEmptyString(data.country)
				const idType = asNonEmptyString(data.id_type)
				const idNumber = asNonEmptyString(data.id_number)
				const firstName = asNonEmptyString(data.first_name)
				const lastName = asNonEmptyString(data.last_name)
				const dob = asNonEmptyString(data.dob)

				if (
					!country ||
					!idType ||
					!idNumber ||
					!firstName ||
					!lastName ||
					!dob
				) {
					res.status(400).json({
						error:
							"country, id_type, id_number, first_name, last_name, and dob are required",
					})
					return
				}

				const govJobId = await submitDocumentVerification({
					walletAddress,
					country,
					idType,
					idNumber,
					firstName,
					lastName,
					dob,
				})
				await upsertVerification(walletAddress, "government_id", "pending", {
					providerRef: govJobId,
				})
				res.json({
					message:
						"Government ID submitted. Result will be delivered asynchronously.",
					jobId: govJobId,
				})
				break
			}

			case "biometric": {
				const selfieBase64 = asNonEmptyString(data.selfie_base64)
				const country = asNonEmptyString(data.country)
				if (!selfieBase64 || !country) {
					res.status(400).json({
						error: "selfie_base64 and country are required",
					})
					return
				}

				const bioJobId = await submitBiometricVerification({
					walletAddress,
					selfieBase64,
					country,
				})
				await upsertVerification(walletAddress, "biometric", "pending", {
					providerRef: bioJobId,
				})
				res.json({
					message:
						"Biometric check submitted. Result will be delivered asynchronously.",
					jobId: bioJobId,
				})
				break
			}
		}
	} catch (err) {
		log.error(
			{ err, walletAddress: maskAddress(walletAddress), method },
			"Failed to initiate verification",
		)
		res.status(500).json({ error: "Failed to initiate verification" })
	}
}

// ---------------------------------------------------------------------------
// POST /api/identity/confirm — confirm email token or phone OTP
// ---------------------------------------------------------------------------

export async function confirmVerification(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const walletAddress = req.user?.address
	if (!walletAddress) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const method = asNonEmptyString(req.body?.method) as VerificationMethod | null
	if (!method || !VALID_METHODS.has(method)) {
		res.status(400).json({
			error: "method must be one of: email, phone, government_id, biometric",
		})
		return
	}

	try {
		switch (method) {
			case "email": {
				const token = asNonEmptyString(req.body?.token)
				if (!token) {
					res.status(400).json({ error: "token is required" })
					return
				}
				const payload = verifyEmailToken(token)
				if (!payload || payload.walletAddress !== walletAddress) {
					res
						.status(400)
						.json({ error: "Invalid or expired verification token" })
					return
				}
				await upsertVerification(walletAddress, "email", "verified", {
					verifiedAt: new Date(),
					expiresAt: null,
				})
				res.json({ success: true, method: "email" })
				break
			}

			case "phone": {
				const phone = asNonEmptyString(req.body?.phone)
				const code = asNonEmptyString(req.body?.code)
				if (!phone || !code) {
					res.status(400).json({ error: "phone and code are required" })
					return
				}
				const approved = await verifyOtp(phone, code)
				if (!approved) {
					res.status(400).json({ error: "Invalid or expired OTP" })
					return
				}
				await upsertVerification(walletAddress, "phone", "verified", {
					verifiedAt: new Date(),
					expiresAt: null,
				})
				res.json({ success: true, method: "phone" })
				break
			}

			case "government_id":
			case "biometric": {
				res.status(400).json({
					error: `${method} verification is completed asynchronously via webhook`,
				})
				break
			}
		}
	} catch (err) {
		log.error(
			{ err, walletAddress: maskAddress(walletAddress), method },
			"Failed to confirm verification",
		)
		res.status(500).json({ error: "Failed to confirm verification" })
	}
}

// ---------------------------------------------------------------------------
// GET /api/identity/verify/email/callback — handles the email link click
// No JWT required — the HMAC token itself proves identity.
// ---------------------------------------------------------------------------

export async function emailVerificationCallback(
	req: Request,
	res: Response,
): Promise<void> {
	const token = asNonEmptyString(req.query.token as string | undefined)
	const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173"

	if (!token) {
		res.redirect(`${frontendUrl}/verify-email?error=missing_token`)
		return
	}

	const payload = verifyEmailToken(token)
	if (!payload) {
		res.redirect(`${frontendUrl}/verify-email?error=invalid_token`)
		return
	}

	try {
		await upsertVerification(payload.walletAddress, "email", "verified", {
			verifiedAt: new Date(),
			expiresAt: null,
		})
		log.info(
			{ walletAddress: maskAddress(payload.walletAddress) },
			"Email verified via callback link",
		)
		res.redirect(`${frontendUrl}/verify-email?success=true`)
	} catch (err) {
		log.error({ err }, "Failed to persist email verification from callback")
		res.redirect(`${frontendUrl}/verify-email?error=server_error`)
	}
}

// ---------------------------------------------------------------------------
// POST /api/identity/kyc-webhook — Smile Identity async result callback
// Smile Identity signs the payload with SMILE_IDENTITY_WEBHOOK_SECRET.
// ---------------------------------------------------------------------------

export async function kycWebhook(req: Request, res: Response): Promise<void> {
	const signature = asNonEmptyString(
		req.headers["x-smile-signature"] as string | undefined,
	)
	const rawBody =
		typeof req.body === "string" ? req.body : JSON.stringify(req.body)

	const smileSecret = process.env.SMILE_IDENTITY_WEBHOOK_SECRET
	if (smileSecret && signature) {
		const expected = crypto
			.createHmac("sha256", smileSecret)
			.update(rawBody)
			.digest("hex")

		if (
			!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
		) {
			res.status(401).json({ error: "Invalid webhook signature" })
			return
		}
	}

	try {
		const webhookPayload = JSON.parse(rawBody) as {
			job_id: string
			result?: { ResultCode: string }
		}

		const jobId = asNonEmptyString(webhookPayload.job_id)
		const resultCode = asNonEmptyString(webhookPayload.result?.ResultCode)

		if (!jobId || !resultCode) {
			res.status(400).json({ error: "Malformed webhook payload" })
			return
		}

		// Smile Identity ResultCode "1220" = approved
		const newStatus: "verified" | "failed" =
			resultCode === "1220" ? "verified" : "failed"
		const verifiedAt = newStatus === "verified" ? new Date() : null

		await pool.query(
			`UPDATE identity_verifications
			 SET status = $1, verified_at = $2
			 WHERE provider_ref = $3`,
			[newStatus, verifiedAt, jobId],
		)

		log.info({ jobId, status: newStatus }, "KYC webhook processed")
		res.status(200).json({ received: true })
	} catch (err) {
		log.error({ err }, "Failed to process KYC webhook")
		res.status(500).json({ error: "Webhook processing failed" })
	}
}

// ---------------------------------------------------------------------------
// GET /api/identity/status — current verification state per method
// ---------------------------------------------------------------------------

export async function getVerificationStatus(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const walletAddress = req.user?.address
	if (!walletAddress) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	try {
		const result = await pool.query(
			`SELECT method, status, verified_at, expires_at, created_at
			 FROM identity_verifications
			 WHERE wallet_address = $1
			 ORDER BY method ASC`,
			[walletAddress],
		)

		const verifications = result.rows as Array<{
			method: VerificationMethod
			status: string
			verified_at: string | null
			expires_at: string | null
			created_at: string
		}>

		const allVerified =
			verifications.length === VALID_METHODS.size &&
			verifications.every((v) => v.status === "verified")

		res.json({ walletAddress, verifications, allVerified })
	} catch (err) {
		log.error(
			{ err, walletAddress: maskAddress(walletAddress) },
			"Failed to fetch verification status",
		)
		res.status(500).json({ error: "Failed to fetch verification status" })
	}
}

// ---------------------------------------------------------------------------
// GET /api/identity/score — sybil trust score
// ---------------------------------------------------------------------------

export async function getSybilScore(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const walletAddress = req.user?.address
	if (!walletAddress) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	try {
		const result = await pool.query(
			`SELECT method
			 FROM identity_verifications
			 WHERE wallet_address = $1 AND status = 'verified'`,
			[walletAddress],
		)

		const verifiedMethods = new Set<VerificationMethod>(
			result.rows.map((r: { method: VerificationMethod }) => r.method),
		)
		const { score, riskLevel, factors } = computeSybilScore(verifiedMethods)

		res.json({ walletAddress, score, riskLevel, factors })
	} catch (err) {
		log.error(
			{ err, walletAddress: maskAddress(walletAddress) },
			"Failed to compute sybil score",
		)
		res.status(500).json({ error: "Failed to compute sybil score" })
	}
}
