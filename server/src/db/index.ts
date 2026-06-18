import { Pool, type PoolConfig } from "pg"

import { logger } from "../lib/logger"
import { poolMonitor } from "../services/pool-monitor.service"
import { resolvePoolEnvConfig } from "./pool-config"

const log = logger.child({ module: "db" })

export const getPoolConfig = (): PoolConfig => {
	const isProduction = process.env.NODE_ENV === "production"
	const isDevelopment = process.env.NODE_ENV === "development"
	const env = isProduction
		? "production"
		: isDevelopment
			? "development"
			: "staging"
	const config = resolvePoolEnvConfig()

	return {
		connectionString: process.env.DATABASE_URL,
		max: config.max,
		min: config.min,
		idleTimeoutMillis: config.idleTimeoutMillis,
		connectionTimeoutMillis: config.connectionTimeoutMillis,
		ssl: isProduction ? { rejectUnauthorized: false } : false,
		application_name: `learnvault-${env}`,
	}
}

class MockPool {
	async connect() {
		return {
			query: async () => ({ rows: [], rowCount: 0 }),
			release: () => {},
		}
	}
	async query(_text: string, _params?: any[]) {
		return { rows: [], rowCount: 0 }
	}
}

let activePool: Pool | MockPool

try {
	const poolConfig = getPoolConfig()
	activePool = new Pool(poolConfig)
	log.info(
		{
			max: poolConfig.max,
			min: poolConfig.min,
			idleTimeoutMillis: poolConfig.idleTimeoutMillis,
			connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
		},
		"Pool configured",
	)

	if (activePool instanceof Pool) {
		activePool.on("error", (err) => {
			log.error({ err }, "Unexpected error on idle database pool client")
		})
		poolMonitor.initializeMonitor(activePool)
	}
} catch (err) {
	log.warn({ err }, "Failed to create postgres pool, using mock")
	activePool = new MockPool()
}

export const pool = activePool

/**
 * Verifies the database connection on startup.
 * Schema is managed exclusively via migrations (`npm run migrate`).
 * No DDL is executed here.
 */
export const initDb = async () => {
	try {
		if (activePool instanceof Pool) {
			const client = await activePool.connect()
			await client.query("SELECT 1")
			client.release()
			log.info("Postgres connection verified")
			await logPgStatStatementsSnapshot()
		} else {
			log.info("In-memory mock database initialized")
		}
	} catch (err) {
		log.error({ err }, "Connection check failed, falling back to mock")
		activePool = new MockPool()
	}
}

export const db = {
	query: (text: string, params?: any[]) => activePool.query(text, params),
	connected: true,
}

export async function getPgStatStatementsSnapshot(limit = 5): Promise<{
	enabled: boolean
	rows: Array<{
		query: string
		calls: number
		total_exec_time_ms: number
		mean_exec_time_ms: number
		rows: number
	}>
}> {
	if (!(activePool instanceof Pool)) {
		return { enabled: false, rows: [] }
	}

	try {
		const extensionCheck = await activePool.query(
			`SELECT EXISTS (
				SELECT 1
				FROM pg_extension
				WHERE extname = 'pg_stat_statements'
			) AS enabled`,
		)
		const enabled = Boolean(extensionCheck.rows[0]?.enabled)
		if (!enabled) return { enabled: false, rows: [] }

		const statsResult = await activePool.query(
			`SELECT
				LEFT(REGEXP_REPLACE(query, '\\s+', ' ', 'g'), 300) AS query,
				calls::int AS calls,
				total_exec_time::float8 AS total_exec_time_ms,
				mean_exec_time::float8 AS mean_exec_time_ms,
				rows::bigint AS rows
			 FROM pg_stat_statements
			 ORDER BY mean_exec_time DESC
			 LIMIT $1`,
			[Math.max(1, Math.min(limit, 20))],
		)

		return {
			enabled: true,
			rows: statsResult.rows.map((row) => ({
				query: String(row.query),
				calls: Number(row.calls ?? 0),
				total_exec_time_ms: Number(row.total_exec_time_ms ?? 0),
				mean_exec_time_ms: Number(row.mean_exec_time_ms ?? 0),
				rows: Number(row.rows ?? 0),
			})),
		}
	} catch {
		return { enabled: false, rows: [] }
	}
}

async function logPgStatStatementsSnapshot(): Promise<void> {
	const snapshot = await getPgStatStatementsSnapshot(3)
	if (!snapshot.enabled) {
		console.log("[db] pg_stat_statements not enabled")
		return
	}

	if (snapshot.rows.length === 0) {
		console.log("[db] pg_stat_statements enabled (no rows yet)")
		return
	}

	console.log("[db] Slow query snapshot (pg_stat_statements):")
	for (const row of snapshot.rows) {
		console.log(
			`  mean=${row.mean_exec_time_ms.toFixed(2)}ms calls=${row.calls} query=${row.query}`,
		)
	}
}
