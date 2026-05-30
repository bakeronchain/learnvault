import { Router } from "express"

import {
	createCourseReview,
	getCourseReviews,
} from "../controllers/reviews.controller"
import { createRequireAuth } from "../middleware/auth.middleware"
import { type JwtService } from "../services/jwt.service"

export function createReviewsRouter(jwtService: JwtService): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)

	/**
	 * @openapi
	 * /api/courses/{idOrSlug}/reviews:
	 *   get:
	 *     tags: [Reviews]
	 *     summary: Get reviews for a course
	 *     description: Returns paginated reviews and average rating for a published course.
	 *     parameters:
	 *       - in: path
	 *         name: idOrSlug
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Course numeric ID or slug
	 *       - in: query
	 *         name: limit
	 *         schema:
	 *           type: integer
	 *           minimum: 1
	 *           maximum: 100
	 *           default: 20
	 *       - in: query
	 *         name: offset
	 *         schema:
	 *           type: integer
	 *           minimum: 0
	 *           default: 0
	 *     responses:
	 *       200:
	 *         description: List of reviews with aggregate stats
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 data:
	 *                   type: array
	 *                   items:
	 *                     $ref: '#/components/schemas/CourseReview'
	 *                 total:
	 *                   type: integer
	 *                 avgRating:
	 *                   type: number
	 *                   nullable: true
	 *       404:
	 *         $ref: '#/components/responses/NotFoundError'
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	router.get("/courses/:idOrSlug/reviews", getCourseReviews)

	/**
	 * @openapi
	 * /api/courses/{idOrSlug}/reviews:
	 *   post:
	 *     tags: [Reviews]
	 *     summary: Submit a review for a course
	 *     description: Creates a review for a published course. Requires the learner to be enrolled. One review per learner per course.
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: idOrSlug
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: Course numeric ID or slug
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required:
	 *               - rating
	 *             properties:
	 *               rating:
	 *                 type: integer
	 *                 minimum: 1
	 *                 maximum: 5
	 *               reviewText:
	 *                 type: string
	 *                 maxLength: 2000
	 *                 nullable: true
	 *     responses:
	 *       201:
	 *         description: Review created
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/CourseReview'
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 *       403:
	 *         description: Not enrolled in course
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       404:
	 *         $ref: '#/components/responses/NotFoundError'
	 *       409:
	 *         description: Already reviewed this course
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	router.post("/courses/:idOrSlug/reviews", requireAuth, createCourseReview)

	return router
}
