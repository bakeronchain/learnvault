import { Router } from "express"

import {
	createCourse,
	getCourse,
	getCourseLessonById,
	getCourses,
	updateCourse,
} from "../controllers/courses.controller"
import {
	requireCourseAdmin,
	requireCourseAdminIfRequested,
} from "../middleware/course-admin.middleware"

export const coursesRouter = Router()

/**
 * @openapi
 * /api/courses:
 *   get:
 *     tags: [Courses]
 *     summary: List published courses
 *     description: Returns a paginated list of published courses, optionally filtered by track and difficulty.
 *     parameters:
 *       - in: query
 *         name: track
 *         schema:
 *           type: string
 *         description: Filter by course track (case-insensitive)
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [beginner, intermediate, advanced]
 *         description: Filter by difficulty level
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 12
 *         description: Number of courses per page
 *     responses:
 *       200:
 *         description: Paginated list of courses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CourseDetail'
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
<<<<<<< HEAD
coursesRouter.get("/courses", getCourses)

/**
 * @openapi
 * /api/courses/{slug}:
 *   get:
 *     tags: [Courses]
 *     summary: Get a course by slug
 *     description: Returns a single course with all its lessons and quiz data.
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: The course slug
 *     responses:
 *       200:
 *         description: Course with lessons
=======
coursesRouter.get("/courses", requireCourseAdminIfRequested, getCourses)
/**
 * @openapi
 * /api/courses/{idOrSlug}:
 *   get:
 *     tags: [Courses]
 *     summary: Get a single course with lessons
 *     description: Returns course details and all associated lessons by numeric ID or slug.
 *     parameters:
 *       - in: path
 *         name: idOrSlug
 *         required: true
 *         schema:
 *           type: string
 *         description: Course numeric ID or slug
 *     responses:
 *       200:
 *         description: Course details with lessons
>>>>>>> main
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/CourseDetail'
 *                 - type: object
 *                   properties:
 *                     lessons:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Lesson'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
coursesRouter.get("/courses/:idOrSlug", getCourse)

/**
 * @openapi
<<<<<<< HEAD
 * /api/courses/{slug}/lessons/{id}:
 *   get:
 *     tags: [Courses]
 *     summary: Get a specific lesson
 *     description: Returns a single lesson by ID within a course, including quiz questions.
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: The course slug
=======
 * /api/courses/{idOrSlug}/lessons/{id}:
 *   get:
 *     tags: [Courses]
 *     summary: Get a single lesson
 *     description: Returns a specific lesson by ID within a published course.
 *     parameters:
 *       - in: path
 *         name: idOrSlug
 *         required: true
 *         schema:
 *           type: string
 *         description: Course numeric ID or slug
>>>>>>> main
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
<<<<<<< HEAD
 *         description: The lesson ID
=======
 *           minimum: 1
 *         description: Lesson ID
>>>>>>> main
 *     responses:
 *       200:
 *         description: Lesson details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lesson'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
coursesRouter.get("/courses/:idOrSlug/lessons/:id", getCourseLessonById)

/**
 * @openapi
 * /api/courses:
 *   post:
 *     tags: [Courses]
 *     summary: Create a new course
<<<<<<< HEAD
 *     description: Creates a new unpublished course. Requires course admin privileges.
=======
 *     description: Creates an unpublished course. Requires course admin privileges.
>>>>>>> main
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - slug
 *               - track
 *               - difficulty
 *             properties:
 *               title:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               coverImage:
 *                 type: string
 *                 nullable: true
 *               track:
 *                 type: string
 *               difficulty:
 *                 type: string
 *                 enum: [beginner, intermediate, advanced]
 *     responses:
 *       201:
 *         description: Course created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CourseDetail'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
<<<<<<< HEAD
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
=======
>>>>>>> main
 *       409:
 *         description: Slug already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
coursesRouter.post("/courses", requireCourseAdmin, createCourse)
<<<<<<< HEAD
coursesRouter.put("/courses/:id", requireCourseAdmin, updateCourse)
=======

/**
 * @openapi
 * /api/courses/{id}:
 *   patch:
 *     tags: [Courses]
 *     summary: Update a course
 *     description: Partially updates an existing course. Requires course admin privileges.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Course ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               coverImage:
 *                 type: string
 *                 nullable: true
 *               track:
 *                 type: string
 *               difficulty:
 *                 type: string
 *                 enum: [beginner, intermediate, advanced]
 *               published:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated course
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CourseDetail'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         description: Slug already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
coursesRouter.patch("/courses/:id", requireCourseAdmin, updateCourse)
>>>>>>> main
