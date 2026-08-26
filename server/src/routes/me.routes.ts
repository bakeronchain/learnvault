import { Router } from "express"
import { z } from "zod"

import { getMe } from "../controllers/me.controller"
import { createRequireAuth } from "../middleware/auth.middleware"
import { type AuthService } from "../services/auth.service"
import { type DataRightsService } from "../services/data-rights.service"
import { type JwtService } from "../services/jwt.service"

const deletionSchema = z.object({
	confirmation: z.literal("DELETE MY ACCOUNT"),
	signedTransaction: z.string().min(1),
})

/**
 * @openapi
 * /api/me/export:
 *   post:
 *     tags: [Data Rights]
 *     summary: Queue the authenticated learner's data export
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       202: { description: Export queued }
 * /api/me/export/{id}:
 *   get:
 *     tags: [Data Rights]
 *     summary: Get an owned export job and signed download URL
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Export status }
 *       404: { description: Export not found }
 * /api/me/export/{id}/download:
 *   get:
 *     tags: [Data Rights]
 *     summary: Download an export using its short-lived signature
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: token, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Gzip-compressed tar archive }
 *       410: { description: Link invalid or expired }
 * /api/me:
 *   delete:
 *     tags: [Data Rights]
 *     summary: Schedule account deletion after fresh wallet authentication
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       202: { description: Deletion scheduled with a 30-day grace period }
 *       400: { description: Explicit confirmation missing }
 *       401: { description: Fresh wallet authentication failed }
 * /api/me/deletion:
 *   get:
 *     tags: [Data Rights]
 *     summary: Get pending account deletion status
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Deletion status }
 * /api/me/deletion/cancel:
 *   post:
 *     tags: [Data Rights]
 *     summary: Cancel deletion during the grace period
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       204: { description: Deletion cancelled }
 */
export function createMeRouter(
	jwtService: JwtService,
	authService: AuthService,
	dataRightsService: DataRightsService,
): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)

	router.get("/me", requireAuth, getMe)
	router.post("/me/export", requireAuth, async (req, res) => {
		const job = await dataRightsService.requestExport(req.walletAddress!)
		res.status(202).json(job)
	})
	router.get("/me/export/:id", requireAuth, async (req, res) => {
		try {
			const job = await dataRightsService.getExport(
				req.params.id,
				req.walletAddress!,
			)
			res.json({
				...job,
				downloadUrl: job.downloadToken
					? `/api/me/export/${job.id}/download?token=${encodeURIComponent(job.downloadToken)}`
					: undefined,
				downloadToken: undefined,
			})
		} catch {
			res.status(404).json({ error: "Export not found" })
		}
	})
	router.get("/me/export/:id/download", async (req, res) => {
		try {
			const token = z.string().min(1).parse(req.query.token)
			const download = await dataRightsService.getDownload(req.params.id, token)
			res
				.status(200)
				.type("application/gzip")
				.setHeader(
					"Content-Disposition",
					`attachment; filename="learnvault-data-${download.walletAddress.slice(0, 8)}.tar.gz"`,
				)
				.send(download.archive)
		} catch {
			res.status(410).json({ error: "Download link is invalid or expired" })
		}
	})
	router.get("/me/deletion", requireAuth, async (req, res) => {
		const pending = await dataRightsService.getPendingDeletion(
			req.walletAddress!,
		)
		res.json({ pending: Boolean(pending), eraseAfter: pending?.eraseAfter })
	})
	router.delete("/me", requireAuth, async (req, res) => {
		const parsed = deletionSchema.safeParse(req.body)
		if (!parsed.success) {
			res.status(400).json({
				error: 'Type "DELETE MY ACCOUNT" and re-authenticate to continue',
			})
			return
		}
		try {
			const freshSession = await authService.verifySignedTransaction(
				parsed.data.signedTransaction,
			)
			const freshIdentity = await jwtService.verifyWalletToken(
				freshSession.accessToken,
			)
			if (freshIdentity.sub !== req.walletAddress) {
				res.status(401).json({ error: "Re-authentication wallet mismatch" })
				return
			}
			const eraseAfter = await dataRightsService.scheduleDeletion(
				req.walletAddress,
			)
			res.status(202).json({ eraseAfter })
		} catch {
			res.status(401).json({ error: "Fresh wallet re-authentication required" })
		}
	})
	router.post("/me/deletion/cancel", requireAuth, async (req, res) => {
		await dataRightsService.cancelDeletion(req.walletAddress!)
		res.status(204).send()
	})

	return router
}
