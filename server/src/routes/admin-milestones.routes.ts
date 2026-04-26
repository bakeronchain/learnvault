// Admin milestones routes - handles approval/rejection of milestone submissions
// Last updated: 2025-01-24 to resolve CI caching issues
import { Router } from "express"
import {
	listMilestones,
	getPendingMilestones,
	getMilestoneById,
	approveMilestone,
	batchApproveMilestones,
	batchRejectMilestones,
	rejectMilestone,
} from "../controllers/admin-milestones.controller"
import { submitMilestoneReport } from "../controllers/milestone-submit.controller"
import { resubmitMilestoneReport } from "../controllers/milestone-resubmit.controller"
import {
	approveMilestoneBodySchema,
	batchApproveMilestonesBodySchema,
	batchRejectMilestonesBodySchema,
	legacyMilestoneSubmitBodySchema,
	milestoneReportIdParamSchema,
	milestoneSubmitBodySchema,
	rejectMilestoneBodySchema,
} from "../lib/zod-schemas"
import { requireAdmin } from "../middleware/admin.middleware"
import { milestoneSubmissionLimiter } from "../middleware/rate-limit.middleware"
import { validate } from "../middleware/validate.middleware"

export const adminMilestonesRouter = Router()

adminMilestonesRouter.get("/admin/milestones", requireAdmin, listMilestones)

/**
 * @openapi
 * /api/admin/milestones/pending:
 *   get:
 *     tags: [Admin]
 *     summary: List all unverified milestone reports
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending milestone reports
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
adminMilestonesRouter.get(
	"/admin/milestones/pending",
	requireAdmin,
	getPendingMilestones,
)

/**
 * @openapi
 * /api/admin/milestones/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get milestone report details and evidence
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Milestone report with audit log
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
adminMilestonesRouter.get(
	"/admin/milestones/:id",
	requireAdmin,
	validate({
		params: milestoneReportIdParamSchema,
	}),
	getMilestoneById,
)

/**
 * @openapi
 * /api/admin/milestones/{id}/approve:
 *   post:
 *     tags: [Admin]
 *     summary: Approve a milestone report and trigger contract call
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Milestone approved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         description: Report already processed
 */
adminMilestonesRouter.post(
	"/admin/milestones/:id/approve",
	requireAdmin,
	validate({
		params: milestoneReportIdParamSchema,
		body: approveMilestoneBodySchema,
	}),
	approveMilestone,
)

adminMilestonesRouter.post(
	"/admin/milestones/batch-approve",
	requireAdmin,
	validate({
		body: batchApproveMilestonesBodySchema,
	}),
	batchApproveMilestones,
)

/**
 * @openapi
 * /api/admin/milestones/{id}/reject:
 *   post:
 *     tags: [Admin]
 *     summary: Reject a milestone report with a reason
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
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
 *     responses:
 *       200:
 *         description: Milestone rejected
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         description: Report already processed
 */
adminMilestonesRouter.post(
	"/admin/milestones/:id/reject",
	requireAdmin,
	validate({
		params: milestoneReportIdParamSchema,
		body: rejectMilestoneBodySchema,
	}),
	rejectMilestone,
)

adminMilestonesRouter.post(
	"/admin/milestones/batch-reject",
	requireAdmin,
	validate({
		body: batchRejectMilestonesBodySchema,
	}),
	batchRejectMilestones,
)

/**
 * @openapi
 * /api/milestones/submit:
 *   post:
 *     tags: [Milestones]
 *     summary: Scholar submits a milestone report
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [scholarAddress, course_id, milestone_id]
 *             properties:
 *               scholarAddress:
 *                 type: string
 *               course_id:
 *                 type: string
 *               milestone_id:
 *                 type: integer
 *               evidenceGitHub:
 *                 type: string
 *               evidenceIpfsCid:
 *                 type: string
 *               evidenceDescription:
 *                 type: string
 *     responses:
 *       201:
 *         description: Report submitted
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       409:
 *         description: Report already submitted for this milestone
 *       429:
 *         description: Rate limit exceeded
 */
adminMilestonesRouter.post(
	"/milestones/submit",
	milestoneSubmissionLimiter,
	validate({
		body: legacyMilestoneSubmitBodySchema,
	}),
	submitMilestoneReport,
)

adminMilestonesRouter.post(
	"/milestones",
	milestoneSubmissionLimiter,
	validate({
		body: milestoneSubmitBodySchema,
	}),
	submitMilestoneReport,
)

/**
 * @openapi
 * /api/milestones/resubmit:
 *   post:
 *     tags: [Milestones]
 *     summary: Scholar resubmits a rejected milestone report
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id]
 *             properties:
 *               id:
 *                 type: integer
 *               evidenceGithub:
 *                 type: string
 *               evidenceIpfsCid:
 *                 type: string
 *               evidenceDescription:
 *                 type: string
 *     responses:
 *       200:
 *         description: Report resubmitted
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       404:
 *         description: Report not found
 *       429:
 *         description: Rate limit exceeded
 */
adminMilestonesRouter.post(
	"/milestones/resubmit",
	milestoneSubmissionLimiter,
	resubmitMilestoneReport,
)
