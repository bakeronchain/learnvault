import { type Request, type Response } from "express"

export const getHealth = (_req: Request, res: Response): void => {
	res.status(200).json({
		status: "ok",
		timestamp: new Date().toISOString(),
	})
}
