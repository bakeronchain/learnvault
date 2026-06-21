import { logger } from "../lib/logger"

const log = logger.child({ module: "smile-identity" })

const SMILE_API_BASE = "https://api.smileidentity.com/v1"

export interface DocumentVerificationParams {
	walletAddress: string
	country: string
	idType: string
	idNumber: string
	firstName: string
	lastName: string
	dob: string // ISO date: YYYY-MM-DD
}

export interface BiometricVerificationParams {
	walletAddress: string
	selfieBase64: string
	country: string
}

interface SmileJobResponse {
	job_id: string
	result?: {
		ResultCode: string
		ResultText: string
	}
}

function getConfig(): { partnerId: string; apiKey: string } {
	const partnerId = process.env.SMILE_IDENTITY_PARTNER_ID
	const apiKey = process.env.SMILE_IDENTITY_API_KEY

	if (!partnerId || !apiKey) {
		throw new Error(
			"SMILE_IDENTITY_PARTNER_ID and SMILE_IDENTITY_API_KEY are required",
		)
	}
	return { partnerId, apiKey }
}

/**
 * Submits a government ID document for verification via Smile Identity.
 * Returns the job_id to be stored as provider_ref in the DB.
 * Throws on network or API failure.
 *
 * Smile Identity covers most African countries with free-tier document checks.
 * Ref: https://docs.smileidentity.com/server-to-server/identity-lookup
 */
export async function submitDocumentVerification(
	params: DocumentVerificationParams,
): Promise<string> {
	const { partnerId, apiKey } = getConfig()

	const payload = {
		partner_id: partnerId,
		api_key: apiKey,
		country: params.country,
		id_type: params.idType,
		id_number: params.idNumber,
		first_name: params.firstName,
		last_name: params.lastName,
		dob: params.dob,
		partner_params: {
			user_id: params.walletAddress,
			job_id: `gov-${params.walletAddress}-${Date.now()}`,
			job_type: 5, // Enhanced KYC
		},
	}

	const response = await fetch(`${SMILE_API_BASE}/id_verification`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	})

	if (!response.ok) {
		const text = await response.text()
		log.error(
			{ status: response.status, body: text },
			"Smile Identity document submission failed",
		)
		throw new Error("Failed to submit document for verification")
	}

	const data = (await response.json()) as SmileJobResponse
	log.info({ jobId: data.job_id, walletAddress: params.walletAddress }, "Document verification submitted")
	return data.job_id
}

/**
 * Submits a selfie image for biometric/liveness verification via Smile Identity.
 * Returns the job_id to be stored as provider_ref in the DB.
 * Throws on network or API failure.
 *
 * Ref: https://docs.smileidentity.com/server-to-server/biometric-kyc
 */
export async function submitBiometricVerification(
	params: BiometricVerificationParams,
): Promise<string> {
	const { partnerId, apiKey } = getConfig()

	const payload = {
		partner_id: partnerId,
		api_key: apiKey,
		country: params.country,
		images: [
			{
				image_type_id: 0, // Selfie
				image: params.selfieBase64,
			},
		],
		partner_params: {
			user_id: params.walletAddress,
			job_id: `bio-${params.walletAddress}-${Date.now()}`,
			job_type: 4, // Biometric KYC
		},
		options: {
			return_job_status: false, // async; result delivered via webhook
		},
	}

	const response = await fetch(`${SMILE_API_BASE}/smile_links`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	})

	if (!response.ok) {
		const text = await response.text()
		log.error(
			{ status: response.status, body: text },
			"Smile Identity biometric submission failed",
		)
		throw new Error("Failed to submit biometric for verification")
	}

	const data = (await response.json()) as SmileJobResponse
	log.info({ jobId: data.job_id, walletAddress: params.walletAddress }, "Biometric verification submitted")
	return data.job_id
}
