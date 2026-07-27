import { Router, type Response } from "express"
import {
	claimReferral,
	getMyReferrals,
	getReferralCode,
} from "../controllers/referral.controller"
import { authMiddleware, type AuthRequest } from "../middleware/auth.middleware"

const router = Router()

router.get("/referrals/code", authMiddleware, (req, res) => {
	void getReferralCode(req as AuthRequest, res as Response)
})

router.post("/referrals/claim", authMiddleware, (req, res) => {
	void claimReferral(req as AuthRequest, res as Response)
})

router.get("/referrals/mine", authMiddleware, (req, res) => {
	void getMyReferrals(req as AuthRequest, res as Response)
})

export { router as referralRouter }
