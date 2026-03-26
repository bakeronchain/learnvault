import { Router } from "express"

import {
	createEnrollment,
	getEnrollments,
} from "../controllers/enrollments.controller"
import * as schemas from "../lib/zod-schemas"
import { validate } from "../middleware/validation.middleware"

export const enrollmentsRouter = Router()

/**
 * @openapi
 * /api/enrollments:
 *   post:
 *     tags: [Enrollments]
 *     summary: Create a new course enrollment
 *     description: |
 *       Records a course enrollment in the database after validating
 *       the on-chain enrollment via the CourseMilestone contract.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - learner_address
 *               - course_id
 *               - tx_hash
 *             properties:
 *               learner_address:
 *                 type: string
 *                 description: The learner's Stellar wallet address
 *               course_id:
 *                 type: string
 *                 description: The course identifier (e.g., "stellar-basics")
 *               tx_hash:
 *                 type: string
 *                 description: The transaction hash of the on-chain enrollment
 *           example:
 *             learner_address: "GABCD123456789..."
 *             course_id: "stellar-basics"
 *             tx_hash: "abc123def456"
 *     responses:
 *       201:
 *         description: Enrollment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enrollment_id:
 *                   type: integer
 *                 enrolled_at:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation error or not enrolled on-chain
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Already enrolled in this course
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
enrollmentsRouter.post(
	"/enrollments",
	validate({
		body: schemas.enrollmentBodySchema,
	}),
	createEnrollment,
)

/**
 * @openapi
 * /api/enrollments:
 *   get:
 *     tags: [Enrollments]
 *     summary: Get enrollments for a learner
 *     description: Returns all courses a learner is enrolled in
 *     parameters:
 *       - in: query
 *         name: learner_address
 *         required: true
 *         schema:
 *           type: string
 *         description: The learner's Stellar wallet address
 *     responses:
 *       200:
 *         description: Enrollments fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       enrollment_id:
 *                         type: integer
 *                       course_id:
 *                         type: string
 *                       tx_hash:
 *                         type: string
 *                       enrolled_at:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Missing learner_address parameter
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
enrollmentsRouter.get("/enrollments", getEnrollments)
