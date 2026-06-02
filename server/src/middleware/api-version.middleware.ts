import { type NextFunction, type Request, type Response } from "express"

/** Current API version prefix. All routes are served under this path. */
export const API_V1_PREFIX = "/api/v1"

/**
 * Legacy `/api/*` paths that must NOT be redirected to `/api/v1/*` because they
 * are infrastructure endpoints rather than versioned API resources.
 */
const NON_VERSIONED_PATHS = new Set<string>(["/api/docs"])

/**
 * Backwards-compatibility shim for the move to versioned routes.
 *
 * Any request to a legacy `/api/*` path (that is not already `/api/v1/*` and is
 * not an excluded infrastructure path) is answered with a `301 Moved
 * Permanently` to the equivalent `/api/v1/*` path, preserving the query string.
 *
 * Requests already targeting `/api/v1/*` pass straight through.
 */
export function apiVersionRedirect(
	req: Request,
	res: Response,
	next: NextFunction,
): void {
	const { path } = req

	const isApiPath = path === "/api" || path.startsWith("/api/")
	if (!isApiPath) {
		next()
		return
	}

	// Already versioned — nothing to do.
	if (path === API_V1_PREFIX || path.startsWith(`${API_V1_PREFIX}/`)) {
		next()
		return
	}

	if (NON_VERSIONED_PATHS.has(path)) {
		next()
		return
	}

	// Replace the leading "/api" with "/api/v1", keeping any query string.
	const suffix = req.originalUrl.slice("/api".length)
	res.redirect(301, `${API_V1_PREFIX}${suffix}`)
}
