import { Router } from "express"

import { applyForScholarship } from "../controllers/scholarships.controller"
import { scholarshipApplyLimiter } from "../middleware/rate-limit.middleware"

export const scholarshipsRouter = Router()

/**
 * @openapi
 * /api/scholarships/apply:
 *   post:
 *     tags: [Scholarships]
 *     summary: Submit a scholarship application
 *     description: |
 *       Creates a scholarship proposal on-chain via the ScholarshipTreasury contract
 *       and records it in the database. Generates a 3-milestone program automatically.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScholarshipApplication'
 *           example:
 *             applicant_address: "GABCD123456789..."
 *             full_name: "Jane Doe"
 *             course_id: "stellar-basics"
 *             motivation: "I want to learn blockchain development to build solutions for my community."
 *             evidence_url: "https://github.com/janedoe/portfolio"
 *             amount: 1000
 *     responses:
 *       201:
 *         description: Scholarship application submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 proposal_id:
 *                   type: integer
 *                   description: Database ID of the created proposal
 *                 tx_hash:
 *                   type: string
 *                   description: On-chain transaction hash
 *                 simulated:
 *                   type: boolean
 *                   description: Whether the transaction was simulated (no secret key configured)
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 details:
 *                   type: object
 *                   description: Field-level validation errors
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
scholarshipsRouter.post(
	"/scholarships/apply",
	scholarshipApplyLimiter,
	(req, res) => {
		void applyForScholarship(req, res)
	},
)
