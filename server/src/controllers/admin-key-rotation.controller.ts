import { type Request, type Response } from "express"
import { type AdminKeyRotationService } from "../services/admin-key-rotation.service"

export function createAdminKeyRotationController(
	keyRotationService: AdminKeyRotationService,
) {
	return {
		async rotateKey(req: Request, res: Response): Promise<void> {
			try {
				const { currentKeyHash, reason } = req.body
				const adminAddress = (req as any).admin?.address

				if (!adminAddress) {
					res.status(401).json({ error: "Unauthorized" })
					return
				}

				if (!currentKeyHash || !reason) {
					res.status(400).json({ error: "currentKeyHash and reason required" })
					return
				}

				const newApiKey = await keyRotationService.rotateKey(
					adminAddress,
					currentKeyHash,
					reason,
				)

				res.status(200).json({
					message: "Key rotated successfully",
					newApiKey: newApiKey,
					warning:
						"Store this key securely. Old key will be valid for 1 hour during transition.",
				})
			} catch (error) {
				const message = error instanceof Error ? error.message : "Unknown error"
				res.status(400).json({ error: message })
			}
		},

		async getActiveKeys(req: Request, res: Response): Promise<void> {
			try {
				const adminAddress = (req as any).admin?.address

				if (!adminAddress) {
					res.status(401).json({ error: "Unauthorized" })
					return
				}

				const keys = await keyRotationService.getActiveKeys(adminAddress)

				res.status(200).json({
					keys: keys.map((k) => ({
						id: k.id,
						keyName: k.key_name,
						lastRotated: k.last_rotated_at,
						created: k.created_at,
					})),
				})
			} catch (error) {
				res.status(500).json({ error: "Failed to retrieve keys" })
			}
		},

		async checkRotationStatus(req: Request, res: Response): Promise<void> {
			try {
				const adminAddress = (req as any).admin?.address

				if (!adminAddress) {
					res.status(401).json({ error: "Unauthorized" })
					return
				}

				const status = await keyRotationService.checkRotationStatus(adminAddress)

				res.status(200).json({
					lastRotated: status.lastRotated,
					daysSinceRotation: status.daysSinceRotation,
					needsRotation: status.needsRotation,
					message: status.needsRotation
						? `Key should be rotated (${status.daysSinceRotation} days since last rotation)`
						: "Key rotation status: OK",
				})
			} catch (error) {
				res.status(500).json({ error: "Failed to check rotation status" })
			}
		},

		async revokeKey(req: Request, res: Response): Promise<void> {
			try {
				const { keyHash } = req.body
				const adminAddress = (req as any).admin?.address

				if (!adminAddress) {
					res.status(401).json({ error: "Unauthorized" })
					return
				}

				if (!keyHash) {
					res.status(400).json({ error: "keyHash required" })
					return
				}

				await keyRotationService.revokeKey(adminAddress, keyHash)

				res.status(200).json({ message: "Key revoked successfully" })
			} catch (error) {
				res.status(500).json({ error: "Failed to revoke key" })
			}
		},
	}
}
