import { Router } from "express"

import {
	applyForScholarship,
	getScholarshipMetrics,
} from "../controllers/scholarships.controller"
import { scholarshipApplyLimiter } from "../middleware/rate-limit.middleware"

export const scholarshipsRouter = Router()

/**
 * @openapi
 * /api/scholarships/metrics:
 *   get:
 *     summary: Scholarship program health metrics
 *     tags: [Scholarships]
 *     responses:
 *       200:
 *         description: Aggregated scholarship metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 active_scholarships:
 *                   type: integer
 *                 total_scholars:
 *                   type: integer
 *                 completion_rate:
 *                   type: number
 *                 avg_milestones_per_scholar:
 *                   type: number
 *                 dropout_rate:
 *                   type: number
 *                 total_usdc_disbursed:
 *                   type: number
 */
scholarshipsRouter.get("/scholarships/metrics", (req, res) => {
	void getScholarshipMetrics(req, res)
})

/**
 * @openapi
 * /api/scholarships/apply:
 *   post:
 *     summary: Submit a scholarship application
 *     tags: [Scholarships]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               applicant_address:
 *                 type: string
 *               full_name:
 *                 type: string
 *               course_id:
 *                 type: string
 *               motivation:
 *                 type: string
 *               evidence_url:
 *                 type: string
 */
scholarshipsRouter.post(
	"/scholarships/apply",
	scholarshipApplyLimiter,
	(req, res) => {
		void applyForScholarship(req, res)
	},
)
