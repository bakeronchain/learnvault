import Redis from "ioredis"

const NONCE_PREFIX = "learnvault:nonce:"
const DEFAULT_TTL_SECONDS = 300 // 5 minutes

export type NonceStore = {
	getNonce(address: string): Promise<string | null>
	/** Sets nonce only if missing; returns the effective nonce (existing or new). */
	getOrSetNonce(
		address: string,
		nonce: string,
		ttlSeconds?: number,
	): Promise<string>
	deleteNonce(address: string): Promise<void>
}

type MemoryEntry = { nonce: string; expiresAt: number }

function createMemoryStore(): NonceStore {
	const map = new Map<string, MemoryEntry>()

	const sweep = (address: string): void => {
		const e = map.get(address)
		if (e && Date.now() >= e.expiresAt) {
			map.delete(address)
		}
	}

	return {
		async getNonce(address: string): Promise<string | null> {
			sweep(address)
			return map.get(address)?.nonce ?? null
		},

		async getOrSetNonce(
			address: string,
			nonce: string,
			ttlSeconds = DEFAULT_TTL_SECONDS,
		): Promise<string> {
			sweep(address)
			const existing = map.get(address)
			if (existing && Date.now() < existing.expiresAt) {
				return existing.nonce
			}
			const expiresAt = Date.now() + ttlSeconds * 1000
			map.set(address, { nonce, expiresAt })
			return nonce
		},

		async deleteNonce(address: string): Promise<void> {
			map.delete(address)
		},
	}
}

function createRedisStore(redisUrl: string): NonceStore {
	const client = new Redis(redisUrl, {
		maxRetriesPerRequest: 2,
		lazyConnect: false,
	})
	const memoryFallback = createMemoryStore()

	const key = (address: string): string => `${NONCE_PREFIX}${address}`

	return {
		async getNonce(address: string): Promise<string | null> {
			try {
				const v = await client.get(key(address))
				return v
			} catch (err) {
				console.warn("Redis getNonce failed, falling back to memory store:", err)
				return memoryFallback.getNonce(address)
			}
		},

		async getOrSetNonce(
			address: string,
			nonce: string,
			ttlSeconds = DEFAULT_TTL_SECONDS,
		): Promise<string> {
			try {
				const k = key(address)
				const existing = await client.get(k)
				if (existing !== null) {
					const ttl = await client.ttl(k)
					// ttl > 0: key has expiry; ttl === -1: exists with no TTL (still valid)
					if (ttl > 0 || ttl === -1) {
						return existing
					}
				}
				await client.set(k, nonce, "EX", ttlSeconds)
				return nonce
			} catch (err) {
				console.warn("Redis getOrSetNonce failed, falling back to memory store:", err)
				return memoryFallback.getOrSetNonce(address, nonce, ttlSeconds)
			}
		},

		async deleteNonce(address: string): Promise<void> {
			try {
				await client.del(key(address))
			} catch (err) {
				console.warn("Redis deleteNonce failed, falling back to memory store:", err)
				return memoryFallback.deleteNonce(address)
			}
		},
	}
}

export function createNonceStore(redisUrl: string | undefined): NonceStore {
	if (redisUrl && redisUrl.trim().length > 0) {
		return createRedisStore(redisUrl.trim())
	}
	return createMemoryStore()
}
