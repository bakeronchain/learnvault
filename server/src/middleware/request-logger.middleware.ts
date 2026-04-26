import { randomUUID } from "crypto"
import { type NextFunction, type Request, type Response } from "express"
import { runWithRequestContext } from "../lib/request-context"

type LogPayload = {
	requestId: string
	method: string
	path: string
	statusCode: number
	durationMs: number
}

type Logger = {
	info: (payload: LogPayload) => void
}

type RequestLoggerOptions = {
	logger?: Logger
	enabled?: boolean
}

const jsonLogger: Logger = {
	info(payload) {
		process.stdout.write(`${JSON.stringify(payload)}\n`)
	},
}

export function createRequestLogger(options: RequestLoggerOptions = {}) {
	const enabled = options.enabled ?? process.env.NODE_ENV !== "test"
	const logger = options.logger ?? jsonLogger

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

				logger.info({
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
