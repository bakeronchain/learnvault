import rateLimit from "express-rate-limit";

/** 10 nonce requests per IP per minute */
export const nonceRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many nonce requests; try again later" }
});
