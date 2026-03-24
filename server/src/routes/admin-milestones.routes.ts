import { Router } from "express";
import { requireAdmin } from "../middleware/admin.middleware";
import { milestoneSubmitRateLimiter } from "../middleware/milestone-rate-limit.middleware";
import {
  getPendingMilestones,
  getMilestoneById,
  approveMilestone,
  rejectMilestone,
} from "../controllers/admin-milestones.controller";
import { submitMilestoneReport } from "../controllers/milestone-submit.controller";

export const adminMilestonesRouter = Router();

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
  getPendingMilestones
);

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
  getMilestoneById
);

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
  approveMilestone
);

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
  rejectMilestone
);

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
 *             required: [scholarAddress, courseId, milestoneId]
 *             properties:
 *               scholarAddress:
 *                 type: string
 *               courseId:
 *                 type: string
 *               milestoneId:
 *                 type: integer
 *               evidenceGithub:
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
  milestoneSubmitRateLimiter,
  submitMilestoneReport
);
