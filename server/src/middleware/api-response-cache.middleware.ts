import { type Request, type Response, type NextFunction } from "express"
import { API_RESPONSE_CACHE_TTLS, type ApiCacheType, getApiResponseCacheKey, getApiResponseCacheStore } from "../lib/api-response-cache"

/**
 * Redis-backed API cache for JSON responses.
 *
 * Behavior:
 * - Only caches successful `res.status(200).json(...)` responses.
 * - Adds `X-Cache: HIT|MISS` header for debugging.
 * - Cache key includes full `req.originalUrl` (path + query).
 */
export function apiResponseCache(cacheType: ApiCacheType) {
	return async function handler(
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		// Avoid cross-test interference from the in-memory fallback.
		// Individual tests can opt-in with `ENABLE_API_CACHE_IN_TESTS=true`.
		if (
			process.env.NODE_ENV === "test" &&
			process.env.ENABLE_API_CACHE_IN_TESTS !== "true"
		) {
			next()
			return
		}

		if (req.method !== "GET") {
			next()
			return
		}

		const store = getApiResponseCacheStore()
		const key = getApiResponseCacheKey(cacheType, req.originalUrl || req.url)

		const cached = await store.get(key)
		if (cached) {
			res.setHeader("X-Cache", "HIT")
			res.status(200).json(JSON.parse(cached))
			return
		}

		res.setHeader("X-Cache", "MISS")

		const ttlSeconds = API_RESPONSE_CACHE_TTLS[cacheType]
		const originalJson = res.json.bind(res)

		// Intercept JSON responses and store them after sending.
		;(res as any).json = (body: unknown) => {
			const shouldCache =
				res.statusCode === 200 &&
				typeof body !== "undefined" &&
				// We only cache JSON-ish payloads we can re-parse.
				body !== null

			const ret = originalJson(body)
			if (shouldCache) {
				void store
					.set(key, JSON.stringify(body), ttlSeconds)
					.catch(() => {
						/* Non-fatal */
					})
			}
			return ret
		}

		next()
	}
}

