import { type NextFunction, type Request, type Response } from "express"
import { ZodError } from "zod"
import { AppError } from "../errors/app-error-handler"
import * as Sentry from "@sentry/node"

const isProduction = () => process.env.NODE_ENV === "production"

const formatZodErrors = (error: ZodError) =>
	error.issues.map((issue) => ({
		field: issue.path.join(".") || "root",
		message: issue.message,
	}))

export const notFoundHandler = (req: Request, res: Response): void => {
	res.status(404).json({
		error: "Not Found",
		message: `Route ${req.originalUrl} not found`,
	})
}

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
			...(!isProduction() && err.stack ? { stack: err.stack } : {}),
		})
		return
	}

	if (err instanceof ZodError) {
		res.status(400).json({
			error: "Validation failed",
			message: "Validation failed",
			details: formatZodErrors(err),
			...(!isProduction() && err.stack ? { stack: err.stack } : {}),
		})
		return
	}

	const message = isProduction()
		? "Internal Server Error"
		: err instanceof Error
			? err.message
			: "Internal Server Error"

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
		...(!isProduction() && err instanceof Error && err.stack
			? { stack: err.stack }
			: {}),
	})
}
