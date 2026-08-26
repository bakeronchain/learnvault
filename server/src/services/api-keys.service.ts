import { createHash, randomBytes } from "crypto"
import { pool } from "../db"

export type ApiKeyTier = "free" | "partner"

/** Daily request quotas per tier (issue #1060). */
export const TIER_DAILY_QUOTAS: Record<ApiKeyTier, number> = {
	free: 1_000,
	partner: 10_000,
}

export interface ApiKeyRow {
	id: number
	label: string
	owner_email: string | null
	tier: ApiKeyTier
	revoked_at: Date | null
	last_used_at: Date | null
}

function sha256(value: string): string {
	return createHash("sha256").update(value).digest("hex")
}

/**
 * Creates an API key and returns the plaintext exactly once — only the
 * SHA-256 hash is persisted, so a lost key cannot be recovered.
 */
export async function createApiKey(
	label: string,
	tier: ApiKeyTier,
	ownerEmail?: string
): Promise<{ id: number; apiKey: string }> {
	const apiKey = `lv_${randomBytes(24).toString("hex")}`
	const keyHash = sha256(apiKey)

	const result = await pool.query(
		`INSERT INTO api_keys (key_hash, label, owner_email, tier)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id`,
		[keyHash, label, ownerEmail ?? null, tier],
	)

	return { id: result.rows[0].id as number, apiKey }
}

export async function revokeApiKey(keyId: number): Promise<void> {
	await pool.query(
		`UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`,
		[keyId],
	)
}

export async function getApiKeyByHash(keyHash: string): Promise<ApiKeyRow | null> {
	const result = await pool.query(
		`SELECT id, label, owner_email, tier, revoked_at, last_used_at
		 FROM api_keys WHERE key_hash = $1`,
		[keyHash],
	)
	return (result.rows[0] as ApiKeyRow) ?? null
}

/** Resolves a raw X-API-Key header value to its row (null when unknown/revoked). */
export async function validateApiKey(rawKey: string): Promise<ApiKeyRow | null> {
	const row = await getApiKeyByHash(sha256(rawKey))
	if (!row || row.revoked_at) return null
	return row
}

export function dailyQuotaFor(tier: string): number {
	return TIER_DAILY_QUOTAS[tier as ApiKeyTier] ?? TIER_DAILY_QUOTAS.free
}

/** UTC day bucket used for quota accounting. */
export function todayUtc(): string {
	return new Date().toISOString().slice(0, 10)
}

export async function recordUsage(keyId: number, endpoint: string, day: string): Promise<number> {
	const result = await pool.query(
		`INSERT INTO api_key_usage (key_id, endpoint, day, call_count)
		 VALUES ($1, $2, $3, 1)
		 ON CONFLICT (key_id, endpoint, day)
		 DO UPDATE SET call_count = api_key_usage.call_count + 1
		 RETURNING call_count`,
		[keyId, endpoint, day],
	)
	return Number(result.rows[0].call_count)
}

export async function touchLastUsed(keyId: number): Promise<void> {
	await pool.query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [keyId])
}
