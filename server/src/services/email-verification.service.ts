import crypto from "node:crypto"
import { logger } from "../lib/logger"
import { EmailService } from "./email.service"

const log = logger.child({ module: "email-verification" })

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface TokenPayload {
	walletAddress: string
	email: string
	exp: number
}

function getSecret(): string {
	const secret = process.env.EMAIL_VERIFICATION_SECRET
	if (!secret && process.env.NODE_ENV === "production") {
		throw new Error("EMAIL_VERIFICATION_SECRET is required in production")
	}
	return secret ?? "dev-email-verification-secret"
}

/**
 * Generates a stateless, HMAC-signed verification token.
 * No DB row is needed to validate it — the signature and expiry are self-contained.
 */
export function generateEmailToken(
	walletAddress: string,
	email: string,
): string {
	const payload: TokenPayload = {
		walletAddress,
		email,
		exp: Date.now() + TOKEN_TTL_MS,
	}
	const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
	const sig = crypto
		.createHmac("sha256", getSecret())
		.update(encoded)
		.digest("base64url")
	return `${encoded}.${sig}`
}

/**
 * Verifies the HMAC signature and expiry of a token.
 * Returns the decoded payload on success, null on any failure.
 */
export function verifyEmailToken(token: string): TokenPayload | null {
	try {
		const dotIndex = token.lastIndexOf(".")
		if (dotIndex === -1) return null

		const encoded = token.slice(0, dotIndex)
		const sig = token.slice(dotIndex + 1)

		const expected = crypto
			.createHmac("sha256", getSecret())
			.update(encoded)
			.digest("base64url")

		// Timing-safe compare prevents timing-oracle attacks
		const sigBuf = Buffer.from(sig)
		const expectedBuf = Buffer.from(expected)
		if (
			sigBuf.length !== expectedBuf.length ||
			!crypto.timingSafeEqual(sigBuf, expectedBuf)
		) {
			return null
		}

		const payload: TokenPayload = JSON.parse(
			Buffer.from(encoded, "base64url").toString("utf8"),
		)

		if (Date.now() > payload.exp) return null
		return payload
	} catch {
		return null
	}
}

/**
 * Sends a verification email containing a signed callback link.
 * Throws if the underlying provider fails after exhausting retries.
 */
export async function sendVerificationEmail(
	walletAddress: string,
	email: string,
): Promise<void> {
	const token = generateEmailToken(walletAddress, email)
	const serverUrl =
		process.env.SERVER_URL ?? `http://localhost:${process.env.PORT ?? 4000}`
	const callbackUrl = `${serverUrl}/api/identity/verify/email/callback?token=${encodeURIComponent(token)}`

	const emailService = new EmailService()
	const sent = await emailService.sendNotification({
		to: email,
		subject: "Verify your LearnVault identity",
		template: "identity-verification",
		data: {
			callbackUrl,
			unsubscribeUrl: "#",
		},
	})

	if (!sent) {
		log.error({ walletAddress }, "Failed to dispatch verification email")
		throw new Error("Failed to send verification email")
	}

	log.info({ walletAddress }, "Verification email dispatched")
}
