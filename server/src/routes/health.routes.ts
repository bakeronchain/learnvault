import fs from "node:fs"
import path from "node:path"

import { Router } from "express"
import Redis from "ioredis"

import { getHealth } from "../controllers/health.controller"
import {
	getPoolMetrics,
	resetPoolAlerts,
} from "../controllers/metrics.controller"
import { pool } from "../db"

export const healthRouter = Router()

type ComponentStatus = "healthy" | "degraded" | "unhealthy"

type DbConnectionState = "connected" | "disconnected"

type CheckResult = {
	status: ComponentStatus
	responseTimeMs: number | null
	error?: string
	url?: string
	details?: string
}

const appVersion = (() => {
	try {
		const packageJsonPath = path.resolve(__dirname, "../../package.json")
		const packageJsonRaw = fs.readFileSync(packageJsonPath, "utf8")
		const packageJson = JSON.parse(packageJsonRaw) as { version?: string }
		if (packageJson.version && packageJson.version.trim().length > 0) {
			return packageJson.version
		}
	} catch {
		// Ignore and use environment fallback
	}

	return process.env.npm_package_version ?? "unknown"
})()

const resolveGitCommitHash = (): string =>
	process.env.GIT_COMMIT_SHA ??
	process.env.GITHUB_SHA ??
	process.env.VERCEL_GIT_COMMIT_SHA ??
	"unknown"

const resolveHorizonUrl = (): string => {
	const configuredUrl =
		process.env.STELLAR_HORIZON_URL ?? process.env.PUBLIC_STELLAR_HORIZON_URL
	if (configuredUrl && configuredUrl.trim().length > 0) {
		return configuredUrl.trim()
	}

	const network = (process.env.STELLAR_NETWORK ?? "").toLowerCase()
	if (network === "mainnet") {
		return "https://horizon.stellar.org"
	}
	if (network === "local") {
		return "http://localhost:8000"
	}

	return "https://horizon-testnet.stellar.org"
}

const hasPoolStats = (
	candidate: unknown,
): candidate is {
	totalCount: number
	idleCount: number
	waitingCount: number
} => {
	if (!candidate || typeof candidate !== "object") {
		return false
	}

	const maybePool = candidate as {
		totalCount?: unknown
		idleCount?: unknown
		waitingCount?: unknown
	}

	return (
		typeof maybePool.totalCount === "number" &&
		typeof maybePool.idleCount === "number" &&
		typeof maybePool.waitingCount === "number"
	)
}

const getDbPoolStats = () => {
	if (hasPoolStats(pool)) {
		return {
			totalConnections: pool.totalCount,
			idleConnections: pool.idleCount,
			waitingClients: pool.waitingCount,
		}
	}

	return {
		totalConnections: null,
		idleConnections: null,
		waitingClients: null,
	}
}

const checkDatabase = async (): Promise<CheckResult> => {
	const startedAt = Date.now()

	try {
		const result = await pool.query("SELECT 1 AS one")
		const hasRow = Array.isArray(result?.rows) && result.rows.length > 0

		if (!hasRow) {
			return {
				status: "unhealthy",
				responseTimeMs: Date.now() - startedAt,
				error: "DB ping returned no rows",
			}
		}

		return {
			status: "healthy",
			responseTimeMs: Date.now() - startedAt,
		}
	} catch (err) {
		return {
			status: "unhealthy",
			responseTimeMs: Date.now() - startedAt,
			error: err instanceof Error ? err.message : "DB ping failed",
		}
	}
}

const checkRedis = async (): Promise<CheckResult> => {
	const redisUrl = process.env.REDIS_URL?.trim()
	if (!redisUrl) {
		return {
			status: "degraded",
			responseTimeMs: null,
			details: "REDIS_URL not configured",
		}
	}

	const client = new Redis(redisUrl, {
		maxRetriesPerRequest: 1,
		enableOfflineQueue: false,
		connectTimeout: 2000,
	})
	const startedAt = Date.now()

	try {
		const result = await client.ping()
		if (result !== "PONG") {
			return {
				status: "unhealthy",
				responseTimeMs: Date.now() - startedAt,
				error: `Unexpected Redis PING response: ${result}`,
			}
		}

		return {
			status: "healthy",
			responseTimeMs: Date.now() - startedAt,
		}
	} catch (err) {
		return {
			status: "unhealthy",
			responseTimeMs: Date.now() - startedAt,
			error: err instanceof Error ? err.message : "Redis ping failed",
		}
	} finally {
		client.disconnect()
	}
}

const checkHorizon = async (): Promise<CheckResult> => {
	const horizonUrl = resolveHorizonUrl()
	const startedAt = Date.now()

	try {
		const response = await fetch(horizonUrl, {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(5000),
		})

		if (!response.ok) {
			return {
				status: "unhealthy",
				responseTimeMs: Date.now() - startedAt,
				url: horizonUrl,
				error: `Horizon returned HTTP ${response.status}`,
			}
		}

		return {
			status: "healthy",
			responseTimeMs: Date.now() - startedAt,
			url: horizonUrl,
		}
	} catch (err) {
		return {
			status: "unhealthy",
			responseTimeMs: Date.now() - startedAt,
			url: horizonUrl,
			error: err instanceof Error ? err.message : "Horizon request failed",
		}
	}
}

const deriveOverallStatus = (
	databaseStatus: ComponentStatus,
	redisStatus: ComponentStatus,
	horizonStatus: ComponentStatus,
): ComponentStatus => {
	if (databaseStatus === "unhealthy") {
		return "unhealthy"
	}

	if (redisStatus !== "healthy" || horizonStatus !== "healthy") {
		return "degraded"
	}

	return "healthy"
}

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Check service health details
 *     responses:
 *       200:
 *         description: Core services are reachable (or degraded)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *       503:
 *         description: Critical service is unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
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
