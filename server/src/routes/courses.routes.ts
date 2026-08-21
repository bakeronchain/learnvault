import { Router } from "express"

import {
	generateCertificate,
	verifyCertificate,
} from "../controllers/certificates.controller"
import {
	createCourse,
	getCourse,
	getCourseLessonById,
	getCourses,
	getLessonVersionDiff,
	updateLessonVersion,
	updateCourse,
} from "../controllers/courses.controller"
import { apiResponseCache } from "../middleware/api-response-cache.middleware"
import { createRequireAuth } from "../middleware/auth.middleware"
import {
	requireCourseAdmin,
	requireCourseAdminIfRequested,
} from "../middleware/course-admin.middleware"
import { type JwtService } from "../services/jwt.service"

export function createCoursesRouter(jwtService: JwtService): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)

	/**
	 * @openapi
	 * /api/courses:
	 *   get:
	 *     tags: [Courses]
	 *     summary: List courses
	 *     description: >
	 *       Returns paginated, published courses. Every course states which
	 *       content language was actually served: `lang`/`Accept-Language`
	 *       resolve a published translation when one exists, and the response
	 *       is honest when it falls back to English or when the served
	 *       translation is stale (its source has since changed).
	 *     parameters:
	 *       - in: query
	 *         name: lang
	 *         schema:
	 *           type: string
	 *           enum: [en, es, fr, sw]
	 *         description: >
	 *           Requested content language. Falls back to the Accept-Language
	 *           header, then to English. Independent of any UI locale.
	 *       - in: query
	 *         name: track
	 *         schema:
	 *           type: string
	 *       - in: query
	 *         name: search
	 *         schema:
	 *           type: string
	 *       - in: query
	 *         name: difficulty
	 *         schema:
	 *           type: string
	 *           enum: [beginner, intermediate, advanced]
	 *       - in: query
	 *         name: page
	 *         schema:
	 *           type: integer
	 *           minimum: 1
	 *       - in: query
	 *         name: limit
	 *         schema:
	 *           type: integer
	 *           minimum: 1
	 *           maximum: 50
	 *       - in: query
	 *         name: offset
	 *         schema:
	 *           type: integer
	 *           minimum: 0
	 *       - in: query
	 *         name: includeUnpublished
	 *         schema:
	 *           type: boolean
	 *         description: Admin-only; requires bearer auth or x-api-key.
	 *     responses:
	 *       200:
	 *         description: Paginated course list
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 data:
	 *                   type: array
	 *                   items:
	 *                     $ref: '#/components/schemas/CourseDetail'
	 *                 pagination:
	 *                   type: object
	 *                   properties:
	 *                     page: { type: integer }
	 *                     limit: { type: integer }
	 *                     total: { type: integer }
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	router.get(
		"/courses",
		requireCourseAdminIfRequested,
		apiResponseCache("courses"),
		getCourses,
	)

	/**
	 * @openapi
	 * /api/courses/{idOrSlug}:
	 *   get:
	 *     tags: [Courses]
	 *     summary: Get a course with its lessons
	 *     description: >
	 *       Returns course metadata and its version-pinned lessons. Content
	 *       language resolves the same way as the course list: a published
	 *       translation for `lang`, falling back to English with
	 *       `isFallback: true` when none exists. `translationCoverage` reports
	 *       how many of the course's lessons are available in the requested
	 *       language, so a learner can see partial coverage before committing.
	 *     parameters:
	 *       - in: path
	 *         name: idOrSlug
	 *         required: true
	 *         schema:
	 *           type: string
	 *       - in: query
	 *         name: lang
	 *         schema:
	 *           type: string
	 *           enum: [en, es, fr, sw]
	 *       - in: query
	 *         name: learner_address
	 *         schema:
	 *           type: string
	 *         description: Pins lesson content to the learner's enrolled content_version.
	 *     responses:
	 *       200:
	 *         description: Course with nested, language-resolved lessons
	 *         content:
	 *           application/json:
	 *             schema:
	 *               allOf:
	 *                 - $ref: '#/components/schemas/CourseDetail'
	 *                 - type: object
	 *                   properties:
	 *                     enrollmentContentVersion: { type: integer, nullable: true }
	 *                     latestContentVersion: { type: integer }
	 *                     hasUpdatedContent: { type: boolean }
	 *                     lessons:
	 *                       type: array
	 *                       items:
	 *                         $ref: '#/components/schemas/Lesson'
	 *       404:
	 *         $ref: '#/components/responses/NotFoundError'
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	router.get("/courses/:idOrSlug", getCourse)

	/**
	 * @openapi
	 * /api/courses/{idOrSlug}/lessons/{id}:
	 *   get:
	 *     tags: [Courses]
	 *     summary: Get a single lesson
	 *     description: Returns one lesson by its numeric id, language-resolved the same way as course lessons.
	 *     parameters:
	 *       - in: path
	 *         name: idOrSlug
	 *         required: true
	 *         schema:
	 *           type: string
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: integer
	 *       - in: query
	 *         name: lang
	 *         schema:
	 *           type: string
	 *           enum: [en, es, fr, sw]
	 *     responses:
	 *       200:
	 *         description: Lesson content
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/Lesson'
	 *       404:
	 *         $ref: '#/components/responses/NotFoundError'
	 *       500:
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	router.get("/courses/:idOrSlug/lessons/:id", getCourseLessonById)

	// Admin-only endpoint for content-version comparisons on a lesson order slot.
	router.get(
		"/courses/:idOrSlug/lessons/:orderIndex/diff",
		requireCourseAdmin,
		getLessonVersionDiff,
	)

	router.patch(
		"/courses/:idOrSlug/lessons/:orderIndex",
		requireCourseAdmin,
		updateLessonVersion,
	)

	router.post("/courses", requireCourseAdmin, createCourse)
	router.patch("/courses/:id", requireCourseAdmin, updateCourse)

	// Certificate endpoints — generation requires authentication (Issue #667)
	router.get("/courses/:courseId/certificate", requireAuth, generateCertificate)
	router.get("/certificates/:certificateId/verify", verifyCertificate)

	return router
}
