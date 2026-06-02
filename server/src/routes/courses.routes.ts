import { Router } from "express"

import { getCourseById, getCourses } from "../controllers/courses.controller"
import * as schemas from "../lib/zod-schemas"
import { validate } from "../middleware/validation.middleware"

export const coursesRouter = Router()

/**
 * @openapi
 * /api/courses:
 *   get:
 *     tags: [Courses]
 *     summary: List published courses (cursor-paginated)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Maximum number of courses to return
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Opaque base64 pagination token from previous response
 *     responses:
 *       200:
 *         description: Courses fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Course'
 *                 nextCursor:
 *                   type: string
 *                   nullable: true
 *                   description: Cursor token for next page, null when no more pages
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
coursesRouter.get(
	"/courses",
	validate({ query: schemas.coursesQuerySchema }),
	getCourses,
)

/**
 * @openapi
 * /api/courses/{courseId}:
 *   get:
 *     tags: [Courses]
 *     summary: Get a course by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique course identifier
 *     responses:
 *       200:
 *         description: Course fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Course'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
coursesRouter.get(
	"/courses/:courseId",
	validate({
		params: schemas.courseIdParamSchema,
	}),
	getCourseById,
)
