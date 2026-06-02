import { type NextFunction, type Request, type Response } from "express"
import rateLimit from "express-rate-limit"
import { AppError } from "../errors/app-error-handler"
import { validateProviderKey } from "../services/provider-keys.service"

declare global {
	namespace Express {
		interface Request {
			providerId?: number
			providerName?: string
			providerScopes?: string[]
		}
	}
}

export async function requireProviderAuth(
	req: Request,
	_res: Response,
	next: NextFunction,
): Promise<void> {
	const raw = req.headers["x-provider-api-key"]
	if (typeof raw !== "string" || raw.trim().length === 0) {
		return next(new AppError("Missing X-Provider-API-Key header", 401))
	}

	const record = await validateProviderKey(raw.trim())
	if (!record) {
		return next(new AppError("Invalid or revoked provider API key", 401))
	}

	req.providerId = record.id
	req.providerName = record.provider_name
	req.providerScopes = record.scopes

	next()
}

export function requireProviderScope(scope: string) {
	return (req: Request, _res: Response, next: NextFunction): void => {
		if (!req.providerScopes?.includes(scope)) {
			return next(
				new AppError(
					`Provider key does not have required scope: ${scope}`,
					403,
				),
			)
		}
		next()
	}
}

// Per-provider-key rate limiter — keyed on the raw API key header value.
// Default limit is 60 req/min; individual key limits are enforced in the
// middleware above by rejecting after DB lookup if needed, but this gives
// a blanket protection layer before any DB hit.
export const providerRateLimiter = rateLimit({
	windowMs: 60 * 1000,
	limit: 300,
	keyGenerator: (req) =>
		(req.headers["x-provider-api-key"] as string | undefined) ??
		req.ip ??
		"unknown",
	standardHeaders: "draft-7",
	legacyHeaders: false,
	validate: false,
	handler: (_req, _res, next) => {
		next(
			new AppError(
				"Provider rate limit exceeded. See X-RateLimit-* headers for details.",
				429,
			),
		)
	},
})
