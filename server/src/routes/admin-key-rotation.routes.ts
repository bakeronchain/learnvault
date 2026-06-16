import { Router, type Request, type Response } from "express"
import { type Database } from "pg"

import { createAdminKeyRotationController } from "../controllers/admin-key-rotation.controller"
import { createAdminKeyRotationService } from "../services/admin-key-rotation.service"
import { requireAdmin } from "../middleware/admin.middleware"

export function createAdminKeyRotationRouter(db: Database): Router {
	const router = Router()
	const keyRotationService = createAdminKeyRotationService(db)
	const controller = createAdminKeyRotationController(keyRotationService)

	/**
	 * @openapi
	 * /api/admin/rotate-key:
	 *   post:
	 *     summary: Rotate admin API key
	 *     tags:
	 *       - Admin
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - currentKeyHash
	 *               - reason
	 *             properties:
	 *               currentKeyHash:
	 *                 type: string
	 *                 description: Hash of current API key
	 *               reason:
	 *                 type: string
	 *                 description: Reason for rotation (e.g., SCHEDULED, COMPROMISED)
	 *     responses:
	 *       200:
	 *         description: Key rotated successfully
	 */
	router.post("/admin/rotate-key", requireAdmin, (req, res) =>
		controller.rotateKey(req, res),
	)

	/**
	 * @openapi
	 * /api/admin/keys/active:
	 *   get:
	 *     summary: Get active API keys for admin
	 *     tags:
	 *       - Admin
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Active keys retrieved
	 */
	router.get("/admin/keys/active", requireAdmin, (req, res) =>
		controller.getActiveKeys(req, res),
	)

	/**
	 * @openapi
	 * /api/admin/keys/rotation-status:
	 *   get:
	 *     summary: Check key rotation status
	 *     tags:
	 *       - Admin
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Rotation status
	 */
	router.get("/admin/keys/rotation-status", requireAdmin, (req, res) =>
		controller.checkRotationStatus(req, res),
	)

	/**
	 * @openapi
	 * /api/admin/keys/revoke:
	 *   post:
	 *     summary: Revoke an API key
	 *     tags:
	 *       - Admin
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - keyHash
	 *             properties:
	 *               keyHash:
	 *                 type: string
	 *     responses:
	 *       200:
	 *         description: Key revoked successfully
	 */
	router.post("/admin/keys/revoke", requireAdmin, (req, res) =>
		controller.revokeKey(req, res),
	)

	return router
}
