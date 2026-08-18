import { type Response } from "express"

import { logger } from "../lib/logger"
import { type AuthRequest } from "../middleware/auth.middleware"
import { type JwtService } from "../services/jwt.service"
import {
	confirmAddSigner,
	prepareAddSigner,
	type PasskeyAssertionInput,
} from "../services/passkey-signer.service"
import { deployPasskeyWallet } from "../services/passkey-wallet.service"

const log = logger.child({ module: "wallet" })

function errorStatus(message: string): number {
	const isClientError =
		message.includes("required") ||
		message.includes("must be") ||
		message.includes("not valid base64url") ||
		message.includes("not found or expired")
	return isClientError ? 400 : 500
}

export function createWalletControllers(jwtService: JwtService) {
	return {
		async deployWallet(req: AuthRequest, res: Response): Promise<void> {
			const body = (req.body ?? {}) as {
				credentialId?: unknown
				publicKey?: unknown
				deviceLabel?: unknown
			}

			if (!body.credentialId || typeof body.credentialId !== "string") {
				res.status(400).json({ error: "credentialId is required" })
				return
			}
			if (!body.publicKey || typeof body.publicKey !== "string") {
				res.status(400).json({ error: "publicKey is required" })
				return
			}
			if (
				body.deviceLabel !== undefined &&
				typeof body.deviceLabel !== "string"
			) {
				res.status(400).json({ error: "deviceLabel must be a string" })
				return
			}

			try {
				const { contractAddress } = await deployPasskeyWallet({
					credentialId: body.credentialId,
					publicKey: body.publicKey,
					deviceLabel: body.deviceLabel,
				})

				const { accessToken, refreshToken } =
					jwtService.issueTokenPair(contractAddress)

				res.status(201).json({
					walletAddress: contractAddress,
					token: accessToken,
					refreshToken,
					tokenType: "Bearer",
					expiresIn: "24h",
				})
			} catch (err) {
				log.error({ err }, "Failed to deploy passkey wallet")
				const message =
					err instanceof Error ? err.message : "Internal server error"
				res.status(errorStatus(message)).json({ error: message })
			}
		},

		async prepareAddSignerHandler(
			req: AuthRequest,
			res: Response,
		): Promise<void> {
			const address = req.params.address
			if (!req.walletAddress || req.walletAddress !== address) {
				res.status(403).json({ error: "Forbidden" })
				return
			}

			const body = (req.body ?? {}) as {
				credentialId?: unknown
				publicKey?: unknown
				deviceLabel?: unknown
			}
			if (!body.credentialId || typeof body.credentialId !== "string") {
				res.status(400).json({ error: "credentialId is required" })
				return
			}
			if (!body.publicKey || typeof body.publicKey !== "string") {
				res.status(400).json({ error: "publicKey is required" })
				return
			}
			if (
				body.deviceLabel !== undefined &&
				typeof body.deviceLabel !== "string"
			) {
				res.status(400).json({ error: "deviceLabel must be a string" })
				return
			}

			try {
				const result = await prepareAddSigner(
					address,
					body.credentialId,
					body.publicKey,
					body.deviceLabel,
				)
				res.status(200).json(result)
			} catch (err) {
				log.error({ err }, "Failed to prepare add_signer")
				const message =
					err instanceof Error ? err.message : "Internal server error"
				res.status(errorStatus(message)).json({ error: message })
			}
		},

		async confirmAddSignerHandler(
			req: AuthRequest,
			res: Response,
		): Promise<void> {
			const address = req.params.address
			if (!req.walletAddress || req.walletAddress !== address) {
				res.status(403).json({ error: "Forbidden" })
				return
			}

			const body = (req.body ?? {}) as {
				requestId?: unknown
				assertion?: Partial<PasskeyAssertionInput>
			}
			if (!body.requestId || typeof body.requestId !== "string") {
				res.status(400).json({ error: "requestId is required" })
				return
			}
			const assertion = body.assertion
			if (
				!assertion ||
				typeof assertion.credentialId !== "string" ||
				typeof assertion.authenticatorData !== "string" ||
				typeof assertion.clientDataJSON !== "string" ||
				typeof assertion.signature !== "string"
			) {
				res.status(400).json({ error: "assertion is required" })
				return
			}

			try {
				const result = await confirmAddSigner(
					body.requestId,
					assertion as PasskeyAssertionInput,
				)
				res.status(200).json(result)
			} catch (err) {
				log.error({ err }, "Failed to confirm add_signer")
				const message =
					err instanceof Error ? err.message : "Internal server error"
				res.status(errorStatus(message)).json({ error: message })
			}
		},
	}
}
