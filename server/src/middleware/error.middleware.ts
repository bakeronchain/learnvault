import { type NextFunction, type Request, type Response } from "express"
import * as Sentry from "@sentry/node"
import { AppError } from "../errors/app-error-handler"

export const errorHandler = (
	err: unknown,
	req: Request,
	res: Response,
	_next: NextFunction,
): void => {
	if (err instanceof AppError) {
		// Capture expected app errors with appropriate level
		Sentry.captureException(err, {
			level: err.statusCode >= 500 ? "error" : "warning",
			tags: {
				errorType: "AppError",
				statusCode: err.statusCode,
			},
			extra: {
				requestId: req.get("X-Request-ID"),
				path: req.path,
				method: req.method,
				details: err.details,
			},
		})

		res.status(err.statusCode).json({
			error: err.message,
			message: err.message,
			...(err.details ? { details: err.details } : {}),
		})
		return
	}

	const message = err instanceof Error ? err.message : "Internal Server Error"

	// Capture unexpected errors as critical
	Sentry.captureException(err, {
		level: "error",
		tags: {
			errorType: err instanceof Error ? err.constructor.name : "Unknown",
		},
		extra: {
			requestId: req.get("X-Request-ID"),
			path: req.path,
			method: req.method,
			stack: err instanceof Error ? err.stack : undefined,
		},
	})

	res.status(500).json({
		error: message,
		message,
	})
}
