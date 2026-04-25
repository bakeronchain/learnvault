import { type Request, type Response } from "express"
import { type z } from "zod"

import {
	isValidStellarPublicKey,
	type AuthService,
} from "../services/auth.service"
import { linkedWalletsService } from "../services/linked-wallets.service"

const linkBody = z.object({
	address: z.string().min(1),
	signature: z.string().min(1),
})
const primaryBody = z.object({
	address: z.string().min(1),
})

function walletPayload(address: string) {
	return { address, isPrimary: true }
}

export function createMeController(authService: AuthService) {
	return {
		getMe: async (req: Request, res: Response): Promise<void> => {
			const address = req.walletAddress
			if (!address) {
				res.status(401).json({ error: "Unauthorized" })
				return
			}

			const fromDb = await linkedWalletsService.getGroupForStellar(address)
			const wallets =
				fromDb && fromDb.length > 0
					? fromDb.map((w) => ({
							address: w.stellar_address,
							isPrimary: w.is_primary,
						}))
					: [walletPayload(address)]

			res.status(200).json({ address, wallets })
		},

		postLinkWallet: async (req: Request, res: Response): Promise<void> => {
			const me = req.walletAddress
			if (!me) {
				res.status(401).json({ error: "Unauthorized" })
				return
			}
			const parsed = linkBody.safeParse(req.body)
			if (!parsed.success) {
				res
					.status(400)
					.json({ error: "address and signature (Base64) are required" })
				return
			}
			const { address: toLink, signature } = parsed.data
			if (!isValidStellarPublicKey(toLink)) {
				res.status(400).json({ error: "Invalid Stellar public key" })
				return
			}
			try {
				await authService.verifyLinkSignature(toLink, signature)
			} catch (e) {
				const message = e instanceof Error ? e.message : "Verification failed"
				if (
					message === "Invalid Stellar public key" ||
					message === "Invalid signature encoding"
				) {
					res.status(400).json({ error: message })
					return
				}
				res.status(401).json({ error: message })
				return
			}

			const { group, error } = await linkedWalletsService.addLinkedWallet(
				me,
				toLink,
			)
			if (error) {
				res.status(400).json({ error })
				return
			}
			res.status(200).json({
				wallets: group.map((w) => ({
					address: w.stellar_address,
					isPrimary: w.is_primary,
				})),
			})
		},

		patchPrimaryWallet: async (req: Request, res: Response): Promise<void> => {
			const me = req.walletAddress
			if (!me) {
				res.status(401).json({ error: "Unauthorized" })
				return
			}
			const parsed = primaryBody.safeParse(req.body)
			if (!parsed.success) {
				res.status(400).json({ error: "address is required" })
				return
			}
			const { address: primary } = parsed.data
			const result = await linkedWalletsService.setPrimary(me, primary)
			if ("error" in result) {
				res.status(400).json({ error: result.error })
				return
			}
			res.status(200).json({
				wallets: result.group.map((w) => ({
					address: w.stellar_address,
					isPrimary: w.is_primary,
				})),
			})
		},
	}
}
