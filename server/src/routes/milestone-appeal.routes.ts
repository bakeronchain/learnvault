import { Router } from "express"
import {
	appealMilestone,
	resolveAppeal,
} from "../controllers/milestone-appeal.controller"
import { requireAdmin } from "../middleware/admin.middleware"
import {
	type AuthRequest,
	createRequireAuth,
} from "../middleware/auth.middleware"
import { milestoneSubmissionLimiter } from "../middleware/rate-limit.middleware"
import { type JwtService } from "../services/jwt.service"

export function createMilestoneAppealRouter(jwtService: JwtService): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)

	/**
	 * @openapi
	 * /api/milestones/{id}/appeal:
	 *   post:
	 *     tags: [Milestones]
	 *     summary: Submit an appeal for a rejected milestone
	 *     description: >
	 *       The authenticated scholar submits an appeal for a rejected milestone report.
	 *       Only the report owner can appeal, and only when the report status is "rejected".
	 *       One appeal per report (status transitions to "appealed").
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: integer
	 *         description: Milestone report ID
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required: [reason]
	 *             properties:
	 *               reason:
	 *                 type: string
	 *                 maxLength: 2000
	 *                 description: Explanation of why the scholar is appealing the rejection
	 *     responses:
	 *       200:
	 *         description: Appeal submitted
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 data:
	 *                   type: object
	 *                   properties:
	 *                     reportId: { type: integer }
	 *                     status: { type: string, example: appealed }
	 *                     appealReason: { type: string }
	 *                     appealSubmittedAt: { type: string, format: date-time }
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 *       403:
	 *         $ref: '#/components/responses/ForbiddenError'
	 *       404:
	 *         $ref: '#/components/responses/NotFoundError'
	 *       409:
	 *         description: Report is not in rejected state
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	router.post(
		"/milestones/:id/appeal",
		milestoneSubmissionLimiter,
		requireAuth,
		(req, res) => {
			void appealMilestone(req as AuthRequest, res)
		},
	)

	/**
	 * @openapi
	 * /api/admin/milestones/{id}/resolve-appeal:
	 *   post:
	 *     tags: [Admin]
	 *     summary: Resolve a milestone appeal (approve or final-reject)
	 *     description: >
	 *       Second-tier admin reviews and resolves an appealed milestone report.
	 *       If approved, triggers on-chain verify_milestone to mint LRN tokens.
	 *       If rejected, marks as final_rejected and notifies the scholar.
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: integer
	 *         description: Milestone report ID
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required: [approved]
	 *             properties:
	 *               approved:
	 *                 type: boolean
	 *               reason:
	 *                 type: string
	 *                 maxLength: 1000
	 *                 description: Required when approved is false
	 *     responses:
	 *       200:
	 *         description: Appeal resolved
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 *       403:
	 *         $ref: '#/components/responses/ForbiddenError'
	 *       404:
	 *         $ref: '#/components/responses/NotFoundError'
	 *       409:
	 *         description: Report is not in appealed state
	 *       502:
	 *         description: Contract call failed
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	router.post(
		"/admin/milestones/:id/resolve-appeal",
		requireAdmin,
		resolveAppeal,
	)

	return router
}
