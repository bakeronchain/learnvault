import { Router } from "express"

import { getHealth } from "../controllers/health.controller"
import {
	getPoolMetrics,
	resetPoolAlerts,
} from "../controllers/metrics.controller"
import { pool } from "../db"

export const healthRouter = Router()

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Check server health status
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
healthRouter.get("/health", async (req, res) => {
	const [database, redis, stellarHorizon] = await Promise.all([
		checkDatabase(),
		checkRedis(),
		checkHorizon(),
	])

	const overallStatus = deriveOverallStatus(
		database.status,
		redis.status,
		stellarHorizon.status,
	)

	const statusCode = overallStatus === "unhealthy" ? 503 : 200

	res.status(statusCode).json({
		status: overallStatus,
		version: appVersion,
		commitHash: resolveGitCommitHash(),
		timestamp: new Date().toISOString(),
		db: database.status === "healthy" ? "connected" : "disconnected",
		dbPool: getDbPoolStats(),
		checks: {
			database,
			redis,
			stellarHorizon,
		},
	})
})

/**
 * @openapi
 * /api/metrics/pool:
 *   get:
 *     tags: [Monitoring]
 *     summary: Get database pool metrics for monitoring dashboard
 *     responses:
 *       200:
 *         description: Pool metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 metrics:
 *                   type: object
 *                   properties:
 *                     pool:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         active:
 *                           type: number
 *                         idle:
 *                           type: number
 *                         waiting:
 *                           type: number
 *                         capacityUsagePercent:
 *                           type: number
 *                         isNearCapacity:
 *                           type: boolean
 *                     lastAlert:
 *                       type: object
 *                       nullable: true
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
healthRouter.get("/metrics/pool", getPoolMetrics)

/**
 * @openapi
 * /api/metrics/pool/alerts/reset:
 *   post:
 *     tags: [Monitoring]
 *     summary: Reset pool alerts
 *     responses:
 *       200:
 *         description: Alerts reset successfully
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
healthRouter.post("/metrics/pool/alerts/reset", resetPoolAlerts)
