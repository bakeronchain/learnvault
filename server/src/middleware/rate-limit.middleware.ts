import { type Request, type Response, type NextFunction } from "express"
import rateLimit from "express-rate-limit"
import { AppError } from "../errors/app-error-handler"

const createRateLimitHandler =
	(message: string) => (req: Request, res: Response, next: NextFunction) => {
		next(new AppError(message, 429))
	}

export const globalLimiter = rateLimit({
	windowMs: 60 * 1000,
	limit: 100,
	standardHeaders: "draft-7",
	legacyHeaders: false,
	handler: createRateLimitHandler("Too many requests, please try again later."),
})

export const uploadLimiter = rateLimit({
	windowMs: 60 * 1000,
	limit: 5,
	standardHeaders: "draft-7",
	legacyHeaders: false,
	handler: createRateLimitHandler(
		"Upload limit reached. You can upload 5 times per minute.",
	),
})

export const milestoneReportLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 3,
	keyGenerator: (req: Request) =>
		(req.headers["x-wallet-address"] as string) ?? req.ip ?? "unknown",
	standardHeaders: "draft-7",
	legacyHeaders: false,
	handler: createRateLimitHandler(
		"Milestone report limit reached. You can submit 3 reports per hour.",
	),
})

export const proposalSubmissionLimiter = rateLimit({
	windowMs: 24 * 60 * 60 * 1000,
	limit: 1,
	keyGenerator: (req: Request) =>
		(req.headers["x-wallet-address"] as string) ?? req.ip ?? "unknown",
	standardHeaders: "draft-7",
	legacyHeaders: false,
	handler: createRateLimitHandler(
		"Proposal limit reached. You can submit 1 proposal per day.",
	),
})
