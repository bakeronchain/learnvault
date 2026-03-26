import { Router } from "express"

import { applyForScholarship } from "../controllers/scholarships.controller"

export const scholarshipsRouter = Router()

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
scholarshipsRouter.post("/scholarships/apply", (req, res) => {
	void applyForScholarship(req, res)
})
