export interface PoolEnvConfig {
	max: number
	min: number
	idleTimeoutMillis: number
	connectionTimeoutMillis: number
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
	if (!value?.trim()) return fallback
	const parsed = Number.parseInt(value, 10)
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback
	return parsed
}

/**
 * Resolves pg.Pool sizing from environment variables with documented defaults.
 *
 * DB_POOL_MAX              — default 20 (production), 15 (staging), 5 (development)
 * DB_POOL_MIN              — default min(4, max) in production, else 1–2
 * DB_POOL_IDLE_TIMEOUT_MS  — default 30000
 * DB_POOL_CONNECTION_TIMEOUT_MS — default 2000
 */
export function resolvePoolEnvConfig(): PoolEnvConfig {
	const nodeEnv = process.env.NODE_ENV ?? "development"
	const isProduction = nodeEnv === "production"
	const isDevelopment = nodeEnv === "development"

	const defaultMax = isProduction ? 20 : isDevelopment ? 5 : 15
	const defaultMin = isProduction ? 4 : isDevelopment ? 1 : 2

	const max = parsePositiveInt(process.env.DB_POOL_MAX, defaultMax)
	const min = Math.min(
		max,
		parsePositiveInt(process.env.DB_POOL_MIN, Math.min(defaultMin, max)),
	)

	return {
		max,
		min,
		idleTimeoutMillis: parsePositiveInt(
			process.env.DB_POOL_IDLE_TIMEOUT_MS,
			30000,
		),
		connectionTimeoutMillis: parsePositiveInt(
			process.env.DB_POOL_CONNECTION_TIMEOUT_MS,
			2000,
		),
	}
}
