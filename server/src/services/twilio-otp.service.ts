import { logger } from "../lib/logger"

const log = logger.child({ module: "twilio-otp" })

const TWILIO_API_BASE = "https://verify.twilio.com/v2/Services"

function getConfig(): { accountSid: string; authToken: string; serviceSid: string } {
	const accountSid = process.env.TWILIO_ACCOUNT_SID
	const authToken = process.env.TWILIO_AUTH_TOKEN
	const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID

	if (!accountSid || !authToken || !serviceSid) {
		throw new Error(
			"TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID are required",
		)
	}
	return { accountSid, authToken, serviceSid }
}

function basicAuth(accountSid: string, authToken: string): string {
	return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`
}

/**
 * Sends an SMS OTP to the given phone number via Twilio Verify.
 * Throws on network or API failure.
 */
export async function sendOtp(phoneNumber: string): Promise<void> {
	const { accountSid, authToken, serviceSid } = getConfig()

	const body = new URLSearchParams({ To: phoneNumber, Channel: "sms" })
	const response = await fetch(`${TWILIO_API_BASE}/${serviceSid}/Verifications`, {
		method: "POST",
		headers: {
			Authorization: basicAuth(accountSid, authToken),
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: body.toString(),
	})

	if (!response.ok) {
		const text = await response.text()
		log.error({ status: response.status, body: text }, "Twilio send OTP failed")
		throw new Error("Failed to send OTP")
	}

	log.info({ phone: phoneNumber.slice(-4) }, "OTP dispatched")
}

/**
 * Verifies an OTP code against Twilio Verify.
 * Returns true when approved, false when the code is wrong or expired.
 * Throws on network or unexpected API failure.
 */
export async function verifyOtp(
	phoneNumber: string,
	code: string,
): Promise<boolean> {
	const { accountSid, authToken, serviceSid } = getConfig()

	const body = new URLSearchParams({ To: phoneNumber, Code: code })
	const response = await fetch(
		`${TWILIO_API_BASE}/${serviceSid}/VerificationChecks`,
		{
			method: "POST",
			headers: {
				Authorization: basicAuth(accountSid, authToken),
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: body.toString(),
		},
	)

	if (response.status === 404) {
		// Twilio returns 404 when the verification has already been approved or cancelled
		return false
	}

	if (!response.ok) {
		const text = await response.text()
		log.error(
			{ status: response.status, body: text },
			"Twilio verify OTP failed",
		)
		throw new Error("Failed to verify OTP")
	}

	const data = (await response.json()) as { status: string }
	return data.status === "approved"
}
