import rateLimit from "express-rate-limit"

/**
 * Rate limiter for milestone report submissions.
 * Allows 1 report per scholar per milestone (enforced at DB level via UNIQUE constraint),
 * but also caps burst submissions to 10 per IP per 15 minutes to prevent abuse.
 */
export const milestoneSubmitRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req) => {
		// Key by wallet address when available, fall back to IP
		const body = req.body as { scholarAddress?: string }
		return body?.scholarAddress ?? req.ip ?? "unknown"
	},
	message: { error: "Too many milestone submissions; try again later" },
})
