import { type NextFunction, type Request, type Response } from "express"
import { type ZodIssue, type ZodTypeAny } from "zod"

type SchemaMap = {
    body?: ZodTypeAny
    query?: ZodTypeAny
    params?: ZodTypeAny
}

export function validate(schemas: SchemaMap) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const issues: ZodIssue[] = []

        if (schemas.body) {
            const result = schemas.body.safeParse(req.body)
            if (result.success) req.body = result.data
            else issues.push(...result.error.issues)
        }
        if (schemas.query) {
            const result = schemas.query.safeParse(req.query)
            if (result.success) req.query = result.data
            else issues.push(...result.error.issues)
        }
        if (schemas.params) {
            const result = schemas.params.safeParse(req.params)
            if (result.success) req.params = result.data as Request["params"]
            else issues.push(...result.error.issues)
        }

        if (issues.length > 0) {
            res.status(400).json({ errors: issues })
            return
        }
        next()
    }
}
