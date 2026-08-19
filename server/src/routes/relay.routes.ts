import { Router } from "express"

import { feeBump } from "../controllers/relay.controller"
import { createRequireAuth } from "../middleware/auth.middleware"
import { feeBumpRelayLimiter } from "../middleware/rate-limit.middleware"
import { type JwtService } from "../services/jwt.service"

export function createRelayRouter(jwtService: JwtService): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)

	/**
	 * @openapi
	 * /api/relay/fee-bump:
	 *   post:
	 *     tags: [Relay]
	 *     summary: Relay a learner-signed transaction sponsored by the platform
	 *     description: >
	 *       Accepts a learner-signed inner transaction envelope, validates it
	 *       against the LearnVault contract-call allowlist (enroll,
	 *       submit_milestone), wraps it in a fee-bump transaction paid by the
	 *       sponsor account, submits it, and returns the hash. Used when the
	 *       learner's own XLM balance is below the fee threshold. Every
	 *       operation outside the allowlist is rejected outright.
	 *     security: [{ bearerAuth: [] }]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required: [innerTxXdr]
	 *             properties:
	 *               innerTxXdr:
	 *                 type: string
	 *                 description: Base64 XDR of the learner-signed inner transaction envelope.
	 *     responses:
	 *       200:
	 *         description: Relayed
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 hash: { type: string }
	 *       400:
	 *         description: Rejected — invalid envelope, non-allowlisted operation, wrong source account, or fee over the sponsor's cap
	 *       401:
	 *         description: Unauthorized
	 *       429:
	 *         description: Relay rate limit exceeded
	 *       503:
	 *         description: Relayer not configured
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	router.post(
		"/relay/fee-bump",
		requireAuth,
		feeBumpRelayLimiter,
		(req, res) => {
			void feeBump(req, res)
		},
	)

	return router
}
