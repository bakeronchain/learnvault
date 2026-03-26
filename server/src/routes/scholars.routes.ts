import { Router } from "express"
import { z } from "zod"

import {
	getScholarMilestones,
	getScholarsLeaderboard,
} from "../controllers/scholars.controller"
import { validate } from "../middleware/validation.middleware"

export const scholarsRouter = Router()

const scholarMilestonesParamsSchema = z.object({
	address: z.string().trim().min(1, "address is required"),
})

const scholarMilestonesQuerySchema = z.object({
	status: z.enum(["pending", "verified", "rejected", "approved"]).optional(),
	course_id: z.string().trim().min(1, "course_id cannot be empty").optional(),
})

/**
 * @openapi
 * /api/scholars/{address}/milestones:
 *   get:
 *     tags: [Scholars]
 *     summary: Milestone history for a scholar
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema: { type: string }
 *         description: Scholar address
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [pending, verified, rejected]
 *       - in: query
 *         name: course_id
 *         required: false
 *         schema: { type: string }
 *         description: Course id (slug), e.g. stellar-basics
 *     responses:
 *       200:
 *         description: Milestone history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 milestones:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       course_id: { type: string }
 *                       milestone_id: { type: integer }
 *                       status: { type: string, enum: [pending, verified, rejected] }
 *                       evidence_url: { type: string, nullable: true }
 *                       submitted_at: { type: string, format: date-time, nullable: true }
 *                       verified_at: { type: string, format: date-time, nullable: true }
 *                       tx_hash: { type: string, nullable: true }
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
scholarsRouter.get(
	"/scholars/:address/milestones",
	validate({
		params: scholarMilestonesParamsSchema,
		query: scholarMilestonesQuerySchema,
	}),
	getScholarMilestones,
)
scholarsRouter.get("/scholars/leaderboard", (req, res) => {
	void getScholarsLeaderboard(req, res)
})
