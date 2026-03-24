import { type NextFunction, type Request, type Response } from "express"

export const errorHandler = (
	err: unknown,
	_req: Request,
	res: Response,
	_next: NextFunction,
): void => {
	const message = err instanceof Error ? err.message : "Internal Server Error"

	res.status(500).json({
		error: message,
	})
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      statusCode,
      message: err.message || "Internal Server Error",
      details: err.details ?? undefined,
    });
}
