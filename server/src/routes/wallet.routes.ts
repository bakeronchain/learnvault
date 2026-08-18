import { Router } from "express"

import { createWalletControllers } from "../controllers/wallet.controller"
import { createRequireAuth } from "../middleware/auth.middleware"
import { authVerifyLimiter } from "../middleware/rate-limit.middleware"
import { type JwtService } from "../services/jwt.service"

export function createWalletRouter(jwtService: JwtService): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)
	const { deployWallet, prepareAddSignerHandler, confirmAddSignerHandler } =
		createWalletControllers(jwtService)

	/**
	 * @openapi
	 * /api/wallet/deploy:
	 *   post:
	 *     tags: [Wallet]
	 *     summary: Deploy a sponsored passkey smart wallet
	 *     description: Deploys a PasskeyWallet contract instance controlled by the given secp256r1 WebAuthn public key. The learner pays nothing — the platform sponsors deployment. Returns a session token for the new wallet address, same as a wallet-connect login.
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required: [credentialId, publicKey]
	 *             properties:
	 *               credentialId: { type: string, description: "Base64url-encoded WebAuthn credential ID" }
	 *               publicKey: { type: string, description: "Base64url-encoded 65-byte uncompressed SEC1 P-256 public key" }
	 *               deviceLabel: { type: string }
	 *     responses:
	 *       201:
	 *         description: Wallet deployed
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	router.post("/wallet/deploy", authVerifyLimiter, (req, res) => {
		void deployWallet(req, res)
	})

	/**
	 * @openapi
	 * /api/wallet/{address}/signers/prepare:
	 *   post:
	 *     tags: [Wallet]
	 *     summary: Prepare a sponsored add_signer transaction
	 *     description: Builds and simulates an add_signer call for the given wallet, returning a challenge that an already-registered passkey must sign to authorize enrolling the new device.
	 *     security: [{ bearerAuth: [] }]
	 *     parameters:
	 *       - in: path
	 *         name: address
	 *         required: true
	 *         schema: { type: string }
	 *     responses:
	 *       200:
	 *         description: Challenge to sign
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       403:
	 *         description: Forbidden
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	router.post(
		"/wallet/:address/signers/prepare",
		requireAuth,
		authVerifyLimiter,
		(req, res) => {
			void prepareAddSignerHandler(req, res)
		},
	)

	/**
	 * @openapi
	 * /api/wallet/{address}/signers/confirm:
	 *   post:
	 *     tags: [Wallet]
	 *     summary: Confirm and submit a prepared add_signer transaction
	 *     description: Attaches a WebAuthn assertion (signed against the challenge from /prepare) to the pending transaction, submits it sponsored, and records the new device.
	 *     security: [{ bearerAuth: [] }]
	 *     parameters:
	 *       - in: path
	 *         name: address
	 *         required: true
	 *         schema: { type: string }
	 *     responses:
	 *       200:
	 *         description: Signer added
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       403:
	 *         description: Forbidden
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	router.post(
		"/wallet/:address/signers/confirm",
		requireAuth,
		authVerifyLimiter,
		(req, res) => {
			void confirmAddSignerHandler(req, res)
		},
	)

	return router
}
