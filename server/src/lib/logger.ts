type LogLevel = "info" | "warn" | "error"

type LogMeta = Record<string, unknown>

function isProduction(): boolean {
	return process.env.NODE_ENV === "production"
}

function sanitizeError(
	error: Error,
	seen: WeakSet<object>,
): Record<string, unknown> {
	if (seen.has(error)) {
		return {
			name: error.name,
			message: error.message,
			cause: "[Circular]",
		}
	}

	seen.add(error)

	const serialized: Record<string, unknown> = {
		name: error.name,
		message: error.message,
	}

	for (const key of Object.getOwnPropertyNames(error)) {
		if (key === "name" || key === "message") {
			continue
		}

		if (key === "stack" && isProduction()) {
			continue
		}

		const value = (error as unknown as Record<string, unknown>)[key]
		if (value !== undefined) {
			serialized[key] = sanitizeForLogging(value, seen)
		}
	}

	if (!isProduction() && error.stack) {
		serialized.stack = error.stack
	}

	seen.delete(error)
	return serialized
}

export function sanitizeForLogging(
	value: unknown,
	seen: WeakSet<object> = new WeakSet<object>(),
): unknown {
	if (value instanceof Error) {
		return sanitizeError(value, seen)
	}

	if (typeof value === "bigint") {
		return value.toString()
	}

	if (value instanceof Date) {
		return value.toISOString()
	}

	if (Array.isArray(value)) {
		return value.map((item) => sanitizeForLogging(item, seen))
	}

	if (value && typeof value === "object") {
		if (seen.has(value)) {
			return "[Circular]"
		}

		seen.add(value)

		const sanitized: Record<string, unknown> = {}
		for (const [key, nestedValue] of Object.entries(value)) {
			sanitized[key] = sanitizeForLogging(nestedValue, seen)
		}

		seen.delete(value)
		return sanitized
	}

	return value
}

function writeLog(
	level: LogLevel,
	scope: string,
	message: string,
	meta?: LogMeta,
): void {
	const payload = {
		timestamp: new Date().toISOString(),
		level,
		scope,
		message,
		...(meta ? (sanitizeForLogging(meta) as LogMeta) : {}),
	}

	const stream = level === "error" ? process.stderr : process.stdout
	stream.write(`${JSON.stringify(payload)}\n`)
}

export type Logger = {
	info(message: string, meta?: LogMeta): void
	warn(message: string, meta?: LogMeta): void
	error(message: string, meta?: LogMeta): void
}

export function createLogger(scope: string): Logger {
	return {
		info(message, meta) {
			writeLog("info", scope, message, meta)
		},
		warn(message, meta) {
			writeLog("warn", scope, message, meta)
		},
		error(message, meta) {
			writeLog("error", scope, message, meta)
		},
	}
}
