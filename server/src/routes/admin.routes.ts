import { Router } from "express"

import {
	getAdminStats,
	getValidatorAnalytics,
} from "../controllers/admin.controller"
import { requireAdmin } from "../middleware/admin.middleware"

export const adminRouter = Router()

adminRouter.get("/admin/stats", requireAdmin, getAdminStats)

/**
 * @openapi
 * /api/admin/validators/analytics:
 *   get:
 *     tags: [Admin]
 *     summary: Get per-validator milestone review performance analytics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Validator analytics and queue alert status
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
adminRouter.get(
	"/admin/validators/analytics",
	requireAdmin,
	getValidatorAnalytics,
)
