import { randomUUID } from "crypto"
import { type NextFunction, type Request, type Response } from "express"
import { logger as rootLogger } from "../lib/logger"
import { runWithRequestContext } from "../lib/request-context"

// Minimal interface so tests can inject a spy without depending on pino internals.
type Logger = {
	info: (payload: Record<string, unknown>) => void
}

type RequestLoggerOptions = {
	logger?: Logger
	enabled?: boolean
}

const defaultLogger: Logger = {
	info(payload) {
		rootLogger.info(payload, "request")
	},
}

export function createRequestLogger(options: RequestLoggerOptions = {}) {
	const enabled = options.enabled ?? process.env.NODE_ENV !== "test"
	const log = options.logger ?? defaultLogger

	return function requestLogger(
		req: Request,
		res: Response,
		next: NextFunction,
	) {
		const requestId = randomUUID()
		runWithRequestContext({ requestId }, () => {
			const startedAt = process.hrtime.bigint()

			req.requestId = requestId
			res.setHeader("X-Request-ID", requestId)

			res.on("finish", () => {
				if (!enabled) {
					return
				}

				const durationMs =
					Number(process.hrtime.bigint() - startedAt) / 1_000_000

				log.info({
					requestId,
					method: req.method,
					path: req.originalUrl || req.path,
					statusCode: res.statusCode,
					durationMs: Number(durationMs.toFixed(3)),
				})
			})

			next()
		})
	}
}

export const requestLogger = createRequestLogger()
