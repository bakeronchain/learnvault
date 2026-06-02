import { type NextFunction, type Request, type Response } from "express"

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

/**
 * Rejects state-changing requests whose Origin or Referer do not match the
 * allowlist. Browsers cannot set these headers from page JS, so this blocks
 * classical (browser-mediated) CSRF — including against endpoints that do
 * not require authentication.
 *
 * Requests with neither Origin nor Referer are allowed through. This keeps
 * server-to-server clients (curl, Postman, workers) working and matches the
 * posture of the CORS middleware; it is not a trust decision, just a
 * recognition that those requests have no browser fingerprint to validate.
 * Bearer-token auth is the load-bearing defense for that path.
 */
export function createRequireTrustedOrigin(allowedOrigins: readonly string[]) {
	const trusted = new Set(allowedOrigins)

	return function requireTrustedOrigin(
		req: Request,
		res: Response,
		next: NextFunction,
	): void {
		if (!STATE_CHANGING_METHODS.has(req.method)) {
			return next()
		}

		const origin = req.headers.origin
		if (origin) {
			if (trusted.has(origin)) return next()
			res.status(403).json({ error: "Forbidden: untrusted origin" })
			return
		}

		const referer = req.headers.referer
		if (referer) {
			try {
				const refererOrigin = new URL(referer).origin
				if (trusted.has(refererOrigin)) return next()
			} catch {
				// malformed Referer — fall through to reject
			}
			res.status(403).json({ error: "Forbidden: untrusted referer" })
			return
		}

		next()
	}
}
