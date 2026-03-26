import { type NextFunction, type Request, type Response } from "express"
import { AppError } from "../errors/app-error-handler"

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
		})
		return
	}

	const message = err instanceof Error ? err.message : "Internal Server Error"

	res.status(500).json({
		error: message,
		message,
	})
}
