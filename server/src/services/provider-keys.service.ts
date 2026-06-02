import crypto from "crypto"
import { pool } from "../db"

export interface ProviderApiKey {
	id: number
	provider_name: string
	key_prefix: string
	scopes: string[]
	rate_limit_per_minute: number
	is_active: boolean
	created_by: string
	created_at: string
	last_used_at: string | null
}

export interface CreateProviderKeyResult {
	rawKey: string
	record: ProviderApiKey
}

const KEY_BYTES = 32

function generateRawKey(): string {
	return `lvpk_${crypto.randomBytes(KEY_BYTES).toString("hex")}`
}

function hashKey(raw: string): string {
	return crypto.createHash("sha256").update(raw).digest("hex")
}

const RETURNING = `id, provider_name, key_prefix, scopes, rate_limit_per_minute,
	 is_active, created_by, created_at, last_used_at`

export async function createProviderKey(opts: {
	providerName: string
	scopes: string[]
	rateLimitPerMinute: number
	createdBy: string
}): Promise<CreateProviderKeyResult> {
	const raw = generateRawKey()
	const hash = hashKey(raw)
	// "lvpk_" + 8 hex chars — safe prefix shown in the UI
	const prefix = raw.slice(0, 13)

	const result = await pool.query(
		`INSERT INTO provider_api_keys
			(provider_name, key_hash, key_prefix, scopes, rate_limit_per_minute, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING ${RETURNING}`,
		[
			opts.providerName,
			hash,
			prefix,
			opts.scopes,
			opts.rateLimitPerMinute,
			opts.createdBy,
		],
	)

	return { rawKey: raw, record: result.rows[0] as ProviderApiKey }
}

export async function validateProviderKey(
	raw: string,
): Promise<ProviderApiKey | null> {
	const hash = hashKey(raw)

	const result = await pool.query(
		`SELECT ${RETURNING}
		 FROM provider_api_keys
		 WHERE key_hash = $1 AND is_active = true`,
		[hash],
	)

	if (result.rows.length === 0) return null

	// fire-and-forget — update last_used_at without blocking the request
	void pool.query(
		`UPDATE provider_api_keys SET last_used_at = NOW() WHERE key_hash = $1`,
		[hash],
	)

	return result.rows[0] as ProviderApiKey
}

export async function listProviderKeys(): Promise<ProviderApiKey[]> {
	const result = await pool.query(
		`SELECT ${RETURNING}
		 FROM provider_api_keys
		 ORDER BY created_at DESC`,
	)
	return result.rows as ProviderApiKey[]
}

export async function revokeProviderKey(
	id: number,
	revokedBy: string,
): Promise<boolean> {
	const result = await pool.query(
		`UPDATE provider_api_keys
		 SET is_active = false, revoked_at = NOW(), revoked_by = $2
		 WHERE id = $1 AND is_active = true`,
		[id, revokedBy],
	)
	return (result.rowCount ?? 0) > 0
}

export async function updateProviderKey(
	id: number,
	opts: { scopes?: string[]; rateLimitPerMinute?: number },
): Promise<ProviderApiKey | null> {
	const sets: string[] = []
	const params: unknown[] = []
	let idx = 1

	if (opts.scopes !== undefined) {
		sets.push(`scopes = $${idx++}`)
		params.push(opts.scopes)
	}
	if (opts.rateLimitPerMinute !== undefined) {
		sets.push(`rate_limit_per_minute = $${idx++}`)
		params.push(opts.rateLimitPerMinute)
	}

	if (sets.length === 0) return null
	params.push(id)

	const result = await pool.query(
		`UPDATE provider_api_keys SET ${sets.join(", ")}
		 WHERE id = $${idx} AND is_active = true
		 RETURNING ${RETURNING}`,
		params,
	)
	return (result.rows[0] as ProviderApiKey) ?? null
}
