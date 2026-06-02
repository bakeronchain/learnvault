import Redis from "ioredis"
import crypto from "crypto"

/**
 * API response cache for expensive GET endpoints.
 *
 * Cached endpoints + TTLs (seconds):
 * - /api/leaderboard: 300s
 * - /api/treasury/stats: 60s
 * - /api/courses: 600s
 *
 * Cache keys are namespaced per endpoint type, and include the full URL
 * (path + query) to ensure distinct responses are cached separately.
 *
 * When `REDIS_URL` is not configured, this falls back to an in-process memory
 * cache (useful for local dev + unit tests).
 */

export type ApiCacheType = "leaderboard" | "treasury_stats" | "courses"

export const API_RESPONSE_CACHE_TTLS: Record<ApiCacheType, number> = {
	leaderboard: 300,
	treasury_stats: 60,
	courses: 600,
}

const PREFIX = "learnvault:api-cache:"

type MemEntry = { value: string; expiresAt: number }
const memStore = new Map<string, MemEntry>()

function memGet(key: string): string | null {
	const e = memStore.get(key)
	if (!e) return null
	if (Date.now() >= e.expiresAt) {
		memStore.delete(key)
		return null
	}
	return e.value
}

function memSet(key: string, value: string, ttlSeconds: number): void {
	memStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
}

function memInvalidatePrefix(keyPrefix: string): void {
	for (const k of memStore.keys()) {
		if (k.startsWith(keyPrefix)) memStore.delete(k)
	}
}

function hash(input: string): string {
	return crypto.createHash("sha256").update(input).digest("hex")
}

function buildNamespacedKey(cacheType: ApiCacheType, url: string): string {
	return `${PREFIX}${cacheType}:${hash(url)}`
}

export type ApiResponseCacheStore = {
	get(key: string): Promise<string | null>
	set(key: string, value: string, ttlSeconds: number): Promise<void>
	invalidatePrefix(keyPrefix: string): Promise<void>
}

let _store: ApiResponseCacheStore | null = null

export function getApiResponseCacheStore(): ApiResponseCacheStore {
	if (_store) return _store

	const redisUrl = process.env.REDIS_URL?.trim()
	if (redisUrl) {
		const client = new Redis(redisUrl, {
			maxRetriesPerRequest: 1,
			lazyConnect: false,
		})

		client.on("error", (err) => {
			console.error("[api-response-cache] Redis error:", err.message)
		})

		_store = {
			async get(key) {
				try {
					return await client.get(key)
				} catch {
					return null
				}
			},
			async set(key, value, ttlSeconds) {
				try {
					await client.set(key, value, "EX", ttlSeconds)
				} catch {
					// Non-fatal
				}
			},
			async invalidatePrefix(keyPrefix) {
				try {
					const keys = await client.keys(`${keyPrefix}*`)
					if (keys.length > 0) await client.del(...keys)
				} catch {
					// Non-fatal
				}
			},
		}
	} else {
		_store = {
			async get(key) {
				return memGet(key)
			},
			async set(key, value, ttlSeconds) {
				memSet(key, value, ttlSeconds)
			},
			async invalidatePrefix(keyPrefix) {
				memInvalidatePrefix(keyPrefix)
			},
		}
	}

	return _store
}

export function getApiResponseCacheKey(
	cacheType: ApiCacheType,
	reqUrl: string,
): string {
	return buildNamespacedKey(cacheType, reqUrl)
}

export async function invalidateApiResponseCacheType(
	cacheType: ApiCacheType,
): Promise<void> {
	const store = getApiResponseCacheStore()
	// keys start with: `${PREFIX}${cacheType}:`
	const keyPrefix = `${PREFIX}${cacheType}:`
	await store.invalidatePrefix(keyPrefix)
}

// Intentionally exported for tests.
export function _clearMemoryApiResponseCache(): void {
	memStore.clear()
}

