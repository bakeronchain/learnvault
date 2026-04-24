import { type Request, type Response, type NextFunction } from "express"
import rateLimit, { ipKeyGenerator } from "express-rate-limit"
import { AppError } from "../errors/app-error-handler"

const createRateLimitHandler =
	(message: string) => (req: Request, res: Response, next: NextFunction) => {
		next(new AppError(message, 429))
	}

const getBodyWalletValue = (
	req: Request,
	keys: string[],
): string | undefined => {
	const body = req.body as Record<string, unknown> | undefined
	if (!body || typeof body !== "object") return undefined

	for (const key of keys) {
		const value = body[key]
		if (typeof value === "string" && value.trim().length > 0) {
			return value
		}
	}

	return undefined
}

const createWalletKeyGenerator =
	(bodyKeys: string[]) =>
	(req: Request): string => {
		const headerWallet = req.headers["x-wallet-address"]
		if (typeof headerWallet === "string" && headerWallet.trim().length > 0) {
			return headerWallet
		}

		return (
			getBodyWalletValue(req, bodyKeys) ??
			ipKeyGenerator(req.ip ?? "unknown") ??
			"unknown"
		)
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
		(req.headers["x-wallet-address"] as string) ??
		ipKeyGenerator(req.ip ?? "unknown") ??
		"unknown",
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
		(req.headers["x-wallet-address"] as string) ??
		ipKeyGenerator(req.ip ?? "unknown") ??
		"unknown",
	standardHeaders: "draft-7",
	legacyHeaders: false,
	handler: createRateLimitHandler(
		"Proposal limit reached. You can submit 1 proposal per day.",
	),
})

export const authVerifyLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 10,
	standardHeaders: "draft-7",
	legacyHeaders: false,
	handler: createRateLimitHandler(
		"Verification limit reached. You can verify up to 10 times every 15 minutes.",
	),
})

export const scholarshipApplyLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 3,
	keyGenerator: createWalletKeyGenerator(["applicant_address"]),
	standardHeaders: "draft-7",
	legacyHeaders: false,
	handler: createRateLimitHandler(
		"Application limit reached. You can submit 3 scholarship applications per hour.",
	),
})

export const governanceVoteLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 20,
	keyGenerator: createWalletKeyGenerator([
		"walletAddress",
		"wallet_address",
		"voterAddress",
		"voter_address",
	]),
	standardHeaders: "draft-7",
	legacyHeaders: false,
	handler: createRateLimitHandler(
		"Voting limit reached. You can submit 20 governance votes per hour.",
	),
})

export const milestoneSubmissionLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 10,
	keyGenerator: createWalletKeyGenerator(["scholarAddress", "scholar_address"]),
	standardHeaders: "draft-7",
	legacyHeaders: false,
	handler: createRateLimitHandler(
		"Milestone limit reached. You can submit 10 milestone reports per hour.",
	),
})
