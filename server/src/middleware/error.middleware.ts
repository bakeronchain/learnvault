import { type NextFunction, type Request, type Response } from "express"
import { ZodError } from "zod"
import { AppError } from "../errors/app-error-handler"

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
	_req: Request,
	res: Response,
	_next: NextFunction,
): void => {
	if (err instanceof AppError) {
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

	res.status(500).json({
		error: message,
		message,
		...(!isProduction() && err instanceof Error && err.stack
			? { stack: err.stack }
			: {}),
	})
}
