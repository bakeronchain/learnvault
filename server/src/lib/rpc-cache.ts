/**
 * RPC cache for Stellar contract read results.
 * Falls back to an in-process memory store when REDIS_URL is not set.
 *
 * TTLs are intentionally short — these values change on-chain and the
 * event indexer will invalidate them after each batch insert.
 */

import Redis from "ioredis"

export const TTL = {
  /** Token balances — invalidated by Transfer/Mint events */
  BALANCE: 30,
  /** Voting power — invalidated by Delegate/Transfer events */
  VOTING_POWER: 30,
  /** Delegation target — invalidated by Delegate events */
  DELEGATION: 60,
  /** Enrollment status — invalidated by Enroll events */
  ENROLLMENT: 120,
  /** Account sequence numbers — very short, just collapses burst requests */
  SEQUENCE: 5,
  /** Ledger state queries */
  LEDGER: 10,
} as const

const PREFIX = "learnvault:rpc:"

// ── In-memory fallback ────────────────────────────────────────────────────────

type MemEntry = { value: string; expiresAt: number }
const memStore = new Map<string, MemEntry>()

function memGet(key: string): string | null {
  const e = memStore.get(key)
  if (!e) return null
  if (Date.now() >= e.expiresAt) { memStore.delete(key); return null }
  return e.value
}

function memSet(key: string, value: string, ttl: number): void {
  memStore.set(key, { value, expiresAt: Date.now() + ttl * 1000 })
}

function memDel(pattern: string): void {
  // pattern ends with '*' — simple prefix match
  const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern
  for (const k of memStore.keys()) {
    if (k.startsWith(prefix)) memStore.delete(k)
  }
}

// ── Counters (in-process; reset on restart) ───────────────────────────────────

const _counters = { hits: 0, misses: 0 }

export function getRpcCacheStats() {
  return { ..._counters, hitRate: _counters.hits + _counters.misses === 0
    ? 0
    : _counters.hits / (_counters.hits + _counters.misses) }
}

export function resetRpcCacheStats() {
  _counters.hits = 0
  _counters.misses = 0
}

// ── Public interface ──────────────────────────────────────────────────────────

export type RpcCache = {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds: number): Promise<void>
  /** Delete all keys matching a prefix (pass without trailing '*') */
  invalidate(keyPrefix: string): Promise<void>
}

let _cache: RpcCache | null = null

export function getRpcCache(): RpcCache {
  if (_cache) return _cache

  const redisUrl = process.env.REDIS_URL?.trim()

  if (redisUrl) {
    const client = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: false })

    client.on("error", (err) => {
      console.error("[rpc-cache] Redis error:", err.message)
    })

    _cache = {
      async get(key) {
        try {
          const v = await client.get(PREFIX + key)
          if (v !== null) { _counters.hits++; return v }
          _counters.misses++
          return null
        } catch { _counters.misses++; return null }
      },
      async set(key, value, ttl) {
        try { await client.set(PREFIX + key, value, "EX", ttl) }
        catch { /* non-fatal */ }
      },
      async invalidate(keyPrefix) {
        try {
          const keys = await client.keys(`${PREFIX}${keyPrefix}*`)
          if (keys.length) await client.del(...keys)
        } catch { /* non-fatal */ }
      },
    }
  } else {
    _cache = {
      async get(key) {
        const v = memGet(PREFIX + key)
        if (v !== null) { _counters.hits++; return v }
        _counters.misses++
        return null
      },
      async set(key, value, ttl) { memSet(PREFIX + key, value, ttl) },
      async invalidate(keyPrefix) { memDel(`${PREFIX}${keyPrefix}*`) },
    }
  }

  return _cache
}

// ── Key builders (keep cache key logic in one place) ─────────────────────────

export const CacheKey = {
  learnBalance:   (addr: string) => `balance:lrn:${addr}`,
  govBalance:     (addr: string) => `balance:gov:${addr}`,
  votingPower:    (addr: string) => `voting_power:${addr}`,
  delegation:     (addr: string) => `delegation:${addr}`,
  enrollment:     (addr: string, courseId: number) => `enrollment:${addr}:${courseId}`,
  // Prefix-only keys used for bulk invalidation
  prefixBalance:  (addr: string) => `balance:lrn:${addr}`,
  prefixGovBalance:(addr: string) => `balance:gov:${addr}`,
  prefixAllBalances:(addr: string) => `balance:`,   // invalidates all balances
}
