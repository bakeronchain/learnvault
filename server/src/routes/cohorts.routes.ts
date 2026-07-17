import { Router } from "express"

import {
	createCohort,
	getCohortDetail,
	joinCohort,
	leaveCohort,
	listCohorts,
} from "../controllers/cohorts.controller"
import * as schemas from "../lib/zod-schemas"
import { createRequireAuth } from "../middleware/auth.middleware"
import { validate } from "../middleware/validation.middleware"
import { type JwtService } from "../services/jwt.service"

export function createCohortsRouter(jwtService: JwtService): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)

	/**
	 * @openapi
	 * /api/cohorts:
	 *   post:
	 *     tags: [Cohorts]
	 *     summary: Create a study cohort (squad) for a course
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required: [name, course_slug, start_date]
	 *             properties:
	 *               name:
	 *                 type: string
	 *               course_slug:
	 *                 type: string
	 *               start_date:
	 *                 type: string
	 *                 format: date
	 *               max_members:
	 *                 type: integer
	 *                 default: 8
	 *     responses:
	 *       201:
	 *         description: Cohort created (creator auto-joined)
	 *       400:
	 *         description: Validation error
	 *       401:
	 *         description: Unauthorized
	 *       404:
	 *         description: Course not found
	 */
	router.post(
		"/cohorts",
		requireAuth,
		validate({ body: schemas.createCohortBodySchema }),
		createCohort,
	)

	/**
	 * @openapi
	 * /api/cohorts:
	 *   get:
	 *     tags: [Cohorts]
	 *     summary: List cohorts, optionally filtered by course
	 *     parameters:
	 *       - in: query
	 *         name: course
	 *         schema:
	 *           type: string
	 *         description: Course slug to filter by
	 *     responses:
	 *       200:
	 *         description: Cohorts with member counts
	 */
	router.get(
		"/cohorts",
		validate({ query: schemas.listCohortsQuerySchema }),
		listCohorts,
	)

	/**
	 * @openapi
	 * /api/cohorts/{id}:
	 *   get:
	 *     tags: [Cohorts]
	 *     summary: Cohort detail with per-member milestone progress and group completion
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: integer
	 *     responses:
	 *       200:
	 *         description: Cohort detail
	 *       404:
	 *         description: Cohort not found
	 */
	router.get(
		"/cohorts/:id",
		validate({ params: schemas.cohortIdParamSchema }),
		getCohortDetail,
	)

	/**
	 * @openapi
	 * /api/cohorts/{id}/join:
	 *   post:
	 *     tags: [Cohorts]
	 *     summary: Join a cohort (capacity-checked, idempotent)
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: integer
	 *     responses:
	 *       200:
	 *         description: Joined (or already a member)
	 *       401:
	 *         description: Unauthorized
	 *       404:
	 *         description: Cohort not found
	 *       409:
	 *         description: Cohort is full
	 */
	router.post(
		"/cohorts/:id/join",
		requireAuth,
		validate({ params: schemas.cohortIdParamSchema }),
		joinCohort,
	)

	/**
	 * @openapi
	 * /api/cohorts/{id}/leave:
	 *   post:
	 *     tags: [Cohorts]
	 *     summary: Leave a cohort (idempotent)
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: integer
	 *     responses:
	 *       200:
	 *         description: Left the cohort (no-op if not a member)
	 *       401:
	 *         description: Unauthorized
	 *       404:
	 *         description: Cohort not found
	 */
	router.post(
		"/cohorts/:id/leave",
		requireAuth,
		validate({ params: schemas.cohortIdParamSchema }),
		leaveCohort,
	)

	return router
}
