import { Router } from "express"

import { pool } from "../db/index"

export const healthRouter = Router()

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Check server health status
 *     responses:
 *       200:
 *         description: Database is connected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *       503:
 *         description: Database connectivity is degraded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
healthRouter.get("/health", async (_req, res) => {
	const uptime = process.uptime()
	const timestamp = new Date().toISOString()

	try {
		// pg Pool ping: keep it lightweight
		const result: any = await pool.query("SELECT 1 AS one")
		const hasRow = Array.isArray(result?.rows) && result.rows.length > 0

		if (hasRow) {
			res.status(200).json({
				status: "ok",
				db: "connected",
				uptime,
				timestamp,
			})
			return
		}

		console.error("[health] DB ping returned no rows")
		res.status(503).json({
			status: "degraded",
			db: "disconnected",
			uptime,
			timestamp,
		})
	} catch (err) {
		console.error("[health] DB ping failed:", err)
		res.status(503).json({
			status: "degraded",
			db: "disconnected",
			uptime,
			timestamp,
		})
	}
})
