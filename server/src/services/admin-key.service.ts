import { createHash, randomBytes, timingSafeEqual } from "crypto"
import { pool } from "../db/index"

const ADMIN_KEY_TRANSITION_WINDOW_MS = 60 * 60 * 1000
const ADMIN_KEY_STALE_DAYS = 90

type AdminApiKeyStateRow = {
	current_key_hash: string
	previous_key_hash: string | null
	previous_key_expires_at: string | null
	rotated_at: string
	rotated_by: string | null
}

type AdminApiKeyState = {
	currentKeyHash: string
	previousKeyHash: string | null
	previousKeyExpiresAt: Date | null
	rotatedAt: Date
	rotatedBy: string | null
	source: "database" | "env"
}

export type AdminKeyRotationStatus = {
	source: "database" | "env"
	rotatedAt: string | null
	daysSinceRotation: number | null
	stale: boolean
	transitionWindowEndsAt: string | null
}

function getBootstrapAdminApiKey(): string | undefined {
	const key = process.env.ADMIN_API_KEY?.trim()
	return key || undefined
}

function getBootstrapRotationDate(): Date | null {
	const raw = process.env.ADMIN_API_KEY_LAST_ROTATED_AT?.trim()
	if (!raw) return null
	const parsed = new Date(raw)
	return Number.isNaN(parsed.getTime()) ? null : parsed
}

function hashKey(key: string): string {
	return createHash("sha256").update(key).digest("hex")
}

function safeEqualHex(a: string, b: string): boolean {
	const aBuffer = Buffer.from(a, "hex")
	const bBuffer = Buffer.from(b, "hex")
	return (
		aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer)
	)
}

async function readPersistedState(): Promise<AdminApiKeyState | null> {
	try {
		const result = await pool.query<AdminApiKeyStateRow>(
			`SELECT current_key_hash, previous_key_hash, previous_key_expires_at, rotated_at, rotated_by
			 FROM admin_api_key_state
			 WHERE id = TRUE`,
		)
		const row = result.rows[0]
		if (!row) return null

		return {
			currentKeyHash: row.current_key_hash,
			previousKeyHash: row.previous_key_hash,
			previousKeyExpiresAt: row.previous_key_expires_at
				? new Date(row.previous_key_expires_at)
				: null,
			rotatedAt: new Date(row.rotated_at),
			rotatedBy: row.rotated_by,
			source: "database",
		}
	} catch (error) {
		console.warn("[admin-key] Failed to read persisted key state:", error)
		return null
	}
}

async function getActiveState(): Promise<AdminApiKeyState | null> {
	const persisted = await readPersistedState()
	if (persisted) return persisted

	const bootstrapKey = getBootstrapAdminApiKey()
	if (!bootstrapKey) return null

	return {
		currentKeyHash: hashKey(bootstrapKey),
		previousKeyHash: null,
		previousKeyExpiresAt: null,
		rotatedAt: getBootstrapRotationDate() ?? new Date(0),
		rotatedBy: null,
		source: "env",
	}
}

export async function validateAdminApiKey(candidate: string): Promise<boolean> {
	if (!candidate) return false

	const state = await getActiveState()
	if (!state) return false

	const candidateHash = hashKey(candidate)
	if (safeEqualHex(candidateHash, state.currentKeyHash)) {
		return true
	}

	if (
		state.previousKeyHash &&
		state.previousKeyExpiresAt &&
		state.previousKeyExpiresAt.getTime() > Date.now() &&
		safeEqualHex(candidateHash, state.previousKeyHash)
	) {
		return true
	}

	return false
}

export async function rotateAdminApiKey(input: {
	currentKey: string
	rotatedBy?: string | null
}): Promise<{
	newKey: string
	rotatedAt: string
	transitionExpiresAt: string
}> {
	const state = await getActiveState()
	if (!state) {
		throw new Error("ADMIN_API_KEY is not configured")
	}

	const currentKeyHash = hashKey(input.currentKey)
	if (!safeEqualHex(currentKeyHash, state.currentKeyHash)) {
		throw new Error("Current admin API key is invalid")
	}

	const newKey = `lv_admin_${randomBytes(24).toString("hex")}`
	const rotatedAt = new Date()
	const transitionExpiresAt = new Date(
		rotatedAt.getTime() + ADMIN_KEY_TRANSITION_WINDOW_MS,
	)

	try {
		await pool.query(
			`INSERT INTO admin_api_key_state
				(id, current_key_hash, previous_key_hash, previous_key_expires_at, rotated_at, rotated_by, created_at, updated_at)
			 VALUES (TRUE, $1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			 ON CONFLICT (id) DO UPDATE SET
			 	current_key_hash = EXCLUDED.current_key_hash,
			 	previous_key_hash = EXCLUDED.previous_key_hash,
			 	previous_key_expires_at = EXCLUDED.previous_key_expires_at,
			 	rotated_at = EXCLUDED.rotated_at,
			 	rotated_by = EXCLUDED.rotated_by,
			 	updated_at = CURRENT_TIMESTAMP`,
			[
				hashKey(newKey),
				state.currentKeyHash,
				transitionExpiresAt.toISOString(),
				rotatedAt.toISOString(),
				input.rotatedBy ?? null,
			],
		)
	} catch (error) {
		console.warn("[admin-key] Failed to persist rotated key:", error)
		throw new Error("Failed to persist rotated key")
	}

	return {
		newKey,
		rotatedAt: rotatedAt.toISOString(),
		transitionExpiresAt: transitionExpiresAt.toISOString(),
	}
}

export async function getAdminKeyRotationStatus(): Promise<AdminKeyRotationStatus> {
	const state = await getActiveState()
	if (!state) {
		return {
			source: "env",
			rotatedAt: null,
			daysSinceRotation: null,
			stale: true,
			transitionWindowEndsAt: null,
		}
	}

	const rotatedAtMs = state.rotatedAt.getTime()
	const rotatedAtKnown = Number.isFinite(rotatedAtMs) && rotatedAtMs > 0
	const daysSinceRotation = rotatedAtKnown
		? Math.floor((Date.now() - rotatedAtMs) / (24 * 60 * 60 * 1000))
		: null

	return {
		source: state.source,
		rotatedAt: rotatedAtKnown ? state.rotatedAt.toISOString() : null,
		daysSinceRotation,
		stale:
			daysSinceRotation === null ? true : daysSinceRotation > ADMIN_KEY_STALE_DAYS,
		transitionWindowEndsAt: state.previousKeyExpiresAt
			? state.previousKeyExpiresAt.toISOString()
			: null,
	}
}

export async function emitAdminKeyRotationAlertIfNeeded(): Promise<void> {
	const status = await getAdminKeyRotationStatus()
	if (!status.stale) return

	const descriptor =
		status.daysSinceRotation === null
			? "rotation date is unknown"
			: `last rotated ${status.daysSinceRotation} days ago`

	console.warn(
		`[admin-key] ALERT: admin API key rotation is overdue or unverifiable (${descriptor}). Rotate via POST /api/admin/rotate-key.`,
	)
}
