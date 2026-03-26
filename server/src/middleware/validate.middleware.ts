import { type NextFunction, type Request, type Response } from "express"
import { type ZodError, type ZodTypeAny } from "zod"
import { AppError } from "../errors/app-error-handler"

type SchemaMap = {
	body?: ZodTypeAny
	query?: ZodTypeAny
	params?: ZodTypeAny
}

const formatErrors = (
	error: ZodError,
	location: "body" | "query" | "params",
) =>
	error.issues.map((issue) => ({
		field: issue.path.join(".") || location,
		message: issue.message,
	}))

export const validate =
	(schemas: SchemaMap) => (req: Request, _res: Response, next: NextFunction) => {
		try {
			if (schemas.body) {
				const result = schemas.body.safeParse(req.body)
				if (!result.success) {
					throw new AppError(
						"Validation failed",
						400,
						formatErrors(result.error, "body"),
					)
				}
				req.body = result.data
			}

			if (schemas.query) {
				const result = schemas.query.safeParse(req.query)
				if (!result.success) {
					throw new AppError(
						"Validation failed",
						400,
						formatErrors(result.error, "query"),
					)
				}
				req.query = result.data
			}

			if (schemas.params) {
				const result = schemas.params.safeParse(req.params)
				if (!result.success) {
					throw new AppError(
						"Validation failed",
						400,
						formatErrors(result.error, "params"),
					)
				}
				req.params = result.data as Request["params"]
			}

			next()
		} catch (error) {
			next(error)
		}
	}
