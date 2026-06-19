import { Router, type Request, type Response } from "express"
import {
	confirmVerification,
	emailVerificationCallback,
	getSybilScore,
	getVerificationStatus,
	initiateVerification,
	kycWebhook,
} from "../controllers/anti-sybil.controller"
import { authMiddleware, type AuthRequest } from "../middleware/auth.middleware"
import { otpLimiter } from "../middleware/rate-limit.middleware"

const router = Router()

/**
 * POST /api/identity/verify
 * Initiates a verification flow for the authenticated wallet.
 * Body: { method: "email"|"phone"|"government_id"|"biometric", data: { ... } }
 */
router.post(
	"/identity/verify",
	authMiddleware,
	(req, res) => {
		void initiateVerification(req as AuthRequest, res as Response)
	},
)

/**
 * POST /api/identity/confirm
 * Confirms an email token or phone OTP.
 * Rate-limited to 3 attempts/hour per phone number (OTP abuse prevention).
 * Body: { method, token? (email), phone? + code? (phone) }
 */
router.post(
	"/identity/confirm",
	authMiddleware,
	otpLimiter,
	(req, res) => {
		void confirmVerification(req as AuthRequest, res as Response)
	},
)

/**
 * GET /api/identity/verify/email/callback
 * Handles email verification link clicks — no JWT required.
 * Redirects to the frontend with success or error query params.
 */
router.get("/identity/verify/email/callback", (req: Request, res: Response) => {
	void emailVerificationCallback(req, res)
})

/**
 * POST /api/identity/kyc-webhook
 * Receives async verification results from Smile Identity.
 * No user auth — payload is authenticated via HMAC signature.
 */
router.post("/identity/kyc-webhook", (req: Request, res: Response) => {
	void kycWebhook(req, res)
})

/**
 * GET /api/identity/status
 * Returns all verification records for the authenticated wallet.
 */
router.get("/identity/status", authMiddleware, (req, res) => {
	void getVerificationStatus(req as AuthRequest, res as Response)
})

/**
 * GET /api/identity/score
 * Returns the computed sybil trust score for the authenticated wallet.
 */
router.get("/identity/score", authMiddleware, (req, res) => {
	void getSybilScore(req as AuthRequest, res as Response)
})

export { router as antiSybilRouter }
