import { Router } from "express"

import { sponsorAccount, sponsorStatus } from "../controllers/onboarding.controller"
import { requireAdmin } from "../middleware/admin.middleware"
import { authVerifyLimiter } from "../middleware/rate-limit.middleware"

export const onboardingRouter = Router()

/**
 * @openapi
 * /api/onboarding/sponsor-account:
 *   post:
 *     tags: [Onboarding]
 *     summary: Build a sponsored account-creation transaction for a zero-XLM learner
 *     description: >
 *       Builds a transaction that sponsors the reserve for a brand-new Stellar
 *       account (begin_sponsoring_future_reserves / create_account with
 *       startingBalance "0" / optional change_trust / end_sponsoring_future_reserves),
 *       signed by the platform sponsor. The learner must countersign the
 *       returned XDR in their own wallet before it can be submitted — the
 *       server never sees or holds the learner's secret key.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [learnerAddress]
 *             properties:
 *               learnerAddress:
 *                 type: string
 *                 description: The Stellar public key (G...) of a keypair the learner generated or connected locally.
 *               withUsdcTrustline:
 *                 type: boolean
 *                 description: Include a sponsored USDC trustline. Defaults to true when a classic USDC asset is configured.
 *     responses:
 *       200:
 *         description: Sponsor-signed XDR ready for the learner to countersign
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 xdr: { type: string }
 *                 networkPassphrase: { type: string }
 *                 reservesLockedStroops: { type: string }
 *                 includesUsdcTrustline: { type: boolean }
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       503:
 *         description: Sponsor account not configured
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
onboardingRouter.post(
	"/onboarding/sponsor-account",
	authVerifyLimiter,
	(req, res) => {
		void sponsorAccount(req, res)
	},
)

/**
 * @openapi
 * /api/onboarding/sponsor-status:
 *   get:
 *     tags: [Onboarding]
 *     summary: Sponsor treasury status (admin)
 *     description: Sponsor account balance, accounts sponsored, reserves locked, and today's spend — for the admin panel's low-balance warning.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Sponsor status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sponsorAddress: { type: string, nullable: true }
 *                 sponsorBalanceStroops: { type: string, nullable: true }
 *                 accountsSponsored: { type: integer }
 *                 reservesLockedStroops: { type: string }
 *                 spendTodayStroops: { type: string }
 *                 dailySpendCapStroops: { type: string }
 *                 lowBalanceWarning: { type: boolean }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
onboardingRouter.get("/onboarding/sponsor-status", requireAdmin, (req, res) => {
	void sponsorStatus(req, res)
})
