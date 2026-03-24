import { Router } from "express";

import { getCourseById, getCourses } from "../controllers/courses.controller";
import { validate } from "../middleware/validation.middleware";
import * as schemas from "../lib/zod-schemas";

export const coursesRouter = Router();

/**
 * @openapi
 * /api/courses:
 *   get:
 *     tags: [Courses]
 *     summary: List published courses
 *     security:
 *       - bearerAuth: []
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
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
coursesRouter.get("/courses", getCourses);

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
  getCourseById
);
