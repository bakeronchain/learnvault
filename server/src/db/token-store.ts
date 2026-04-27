import crypto from "node:crypto"
import Redis from "ioredis"

const BLOCKLIST_PREFIX = "learnvault:blocklist:"

export type TokenStore = {
	isRevoked(token: string): Promise<boolean>
	revoke(token: string, ttlSeconds: number): Promise<void>
}

function hashToken(token: string): string {
	return crypto.createHash("sha256").update(token).digest("hex")
}

type MemoryEntry = { expiresAt: number }

function createMemoryStore(): TokenStore {
	const map = new Map<string, MemoryEntry>()

	const sweep = (hash: string): void => {
		const e = map.get(hash)
		if (e && Date.now() >= e.expiresAt) {
			map.delete(hash)
		}
	}

	return {
		async isRevoked(token: string): Promise<boolean> {
			const hash = hashToken(token)
			sweep(hash)
			return map.has(hash)
		},

		async revoke(token: string, ttlSeconds: number): Promise<void> {
			const hash = hashToken(token)
			const expiresAt = Date.now() + ttlSeconds * 1000
			map.set(hash, { expiresAt })
		},
	}
}

function createRedisStore(redisUrl: string): TokenStore {
	const client = new Redis(redisUrl, {
		maxRetriesPerRequest: 2,
		lazyConnect: false,
	})

	const key = (hash: string): string => `${BLOCKLIST_PREFIX}${hash}`

	return {
		async isRevoked(token: string): Promise<boolean> {
			const hash = hashToken(token)
			const v = await client.get(key(hash))
			return v !== null
		},

		async revoke(token: string, ttlSeconds: number): Promise<void> {
			const hash = hashToken(token)
			if (ttlSeconds > 0) {
				await client.set(key(hash), "1", "EX", ttlSeconds)
			}
		},
	}
}

export function createTokenStore(redisUrl: string | undefined): TokenStore {
	if (redisUrl && redisUrl.trim().length > 0) {
		return createRedisStore(redisUrl.trim())
	}
	return createMemoryStore()
}
