import path from "node:path"
import fs from "node:fs"
import type { Express } from "express"
import { logger } from "../lib/logger"

const log = logger.child({ module: "openapi-validator" })

function resolveApiSpecPath(): string {
	// When running via `server/` scripts, CWD is usually `server/`.
	const fromCwd = path.resolve(process.cwd(), "..", "docs", "openapi.yaml")
	if (fs.existsSync(fromCwd)) return fromCwd

	// Fallback for other execution contexts (e.g. compiled dist).
	return path.resolve(__dirname, "..", "..", "..", "docs", "openapi.yaml")
}

/**
 * Mount request/response validation against the generated OpenAPI spec.
 *
 * Guarded by `OPENAPI_VALIDATE=true` to avoid slowing normal dev/production.
 * Intended for CI / test environments to catch drift.
 */
export async function maybeMountOpenApiValidator(app: Express): Promise<void> {
	if (process.env.OPENAPI_VALIDATE !== "true") return

	const apiSpec = resolveApiSpecPath()
	if (!fs.existsSync(apiSpec)) {
		log.warn({ apiSpec }, "OpenAPI spec not found; skipping validator")
		return
	}

	// Dynamic import keeps startup light when disabled.
	const OpenApiValidator = await import("express-openapi-validator")

	app.use(
		OpenApiValidator.middleware({
			apiSpec,
			validateRequests: true,
			validateResponses: true,
		}),
	)

	log.info({ apiSpec }, "OpenAPI validator enabled")
}

