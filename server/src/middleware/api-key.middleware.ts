import { type NextFunction, type Request, type Response } from "express"
import {
	dailyQuotaFor,
	recordUsage,
	todayUtc,
	touchLastUsed,
	validateApiKey,
	type ApiKeyRow,
} from "../services/api-keys.service"

declare global {
	namespace Express {
		interface Request {
			openDataKeyId?: number
		}
	}
}

/**
 * Public Open Data API authentication (issue #1060).
 *
 * Resolves X-API-Key against the hashed api_keys table, rejects missing,
 * malformed and revoked keys with 401, records per-endpoint usage, and
 * enforces the per-tier daily quota — returning 429 with a Retry-After
 * header (seconds until the UTC day resets) once exceeded.
 */
export async function requireOpenDataKey(
	endpoint: string,
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> {
	const raw = req.headers["x-api-key"]
	if (typeof raw !== "string" || !raw.startsWith("lv_") || raw.length < 10) {
		res.status(401).json({ error: "Missing or malformed X-API-Key" })
		return
	}

	let key: ApiKeyRow | null = null
	try {
		key = await validateApiKey(raw.trim())
	} catch (err) {
		console.error("[open-data] key lookup failed:", err)
		res.status(500).json({ error: "Internal server error" })
		return
	}

	if (!key) {
		res.status(401).json({ error: "Invalid or revoked API key" })
		return
	}

	const day = todayUtc()
	let callCount: number
	try {
		callCount = await recordUsage(key.id, endpoint, day)
		await touchLastUsed(key.id)
	} catch (err) {
		console.error("[open-data] usage recording failed:", err)
		res.status(500).json({ error: "Internal server error" })
		return
	}

	const quota = dailyQuotaFor(key.tier)
	if (callCount > quota) {
		const retryAfter = secondsUntilUtcReset()
		res.set("Retry-After", String(retryAfter))
		res.status(429).json({
			error: `Daily quota exceeded for tier '${key.tier}' (${quota}/day). Resets at UTC midnight.`,
			retryAfter,
		})
		return
	}

	req.openDataKeyId = key.id
	res.set("X-Quota-Limit", String(quota))
	res.set("X-Quota-Remaining", String(Math.max(0, quota - callCount)))

	next()
}

function secondsUntilUtcReset(): number {
	const now = new Date()
	const nextMidnight = Date.UTC(
		now.getUTCFullYear(),
		now.getUTCMonth(),
		now.getUTCDate() + 1,
		0,
		0,
		0,
		0,
	)
	return Math.max(1, Math.ceil((nextMidnight - now.getTime()) / 1000))
}

/** Builds an express handler bound to a specific endpoint label. */
export function openDataAuth(endpoint: string) {
	return (req: Request, res: Response, next: NextFunction): void => {
		void requireOpenDataKey(endpoint, req, res, next)
	}
}
