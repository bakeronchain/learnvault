import { Router } from "express"
import {
	listFlaggedContent,
	getFlagDetails,
	actionOnFlag,
	getAdminModerationStats,
} from "../controllers/moderation.controller"
import { requireAdmin } from "../middleware/admin.middleware"

export const moderationRouter = Router()

/**
 * @openapi
 * /api/admin/moderation:
 *   get:
 *     tags: [Admin]
 *     summary: List flagged content
 *     description: Returns flagged content queue for moderation. Admins only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, reviewed, dismissed]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Flagged content list
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
moderationRouter.get("/admin/moderation", requireAdmin, listFlaggedContent)

/**
 * @openapi
 * /api/admin/moderation/{flagId}:
 *   get:
 *     tags: [Admin]
 *     summary: Get flag details with content and audit log
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: flagId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Flag details
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
moderationRouter.get(
	"/admin/moderation/:flagId",
	requireAdmin,
	getFlagDetails,
)

/**
 * @openapi
 * /api/admin/moderation/{flagId}/action:
 *   post:
 *     tags: [Admin]
 *     summary: Take action on flagged content
 *     description: Delete, dismiss, or warn for flagged content
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: flagId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [delete, dismiss, warn]
 *               adminNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Action taken
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
moderationRouter.post(
	"/admin/moderation/:flagId/action",
	requireAdmin,
	actionOnFlag,
)

/**
 * @openapi
 * /api/admin/moderation/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Get moderation statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Moderation stats
 */
moderationRouter.get(
	"/admin/moderation/stats",
	requireAdmin,
	getAdminModerationStats,
)
