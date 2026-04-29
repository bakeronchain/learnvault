import { Router } from "express"

import {
	createCourse,
	getCourse,
	getCourseLessonById,
	getCourses,
	getLessonVersionDiff,
	updateLessonVersion,
	updateCourse,
} from "../controllers/courses.controller"
import {
	requireCourseAdmin,
	requireCourseAdminIfRequested,
} from "../middleware/course-admin.middleware"

export const coursesRouter = Router()

coursesRouter.get("/courses", requireCourseAdminIfRequested, getCourses)
coursesRouter.get("/courses/:idOrSlug", getCourse)
coursesRouter.get("/courses/:idOrSlug/lessons/:id", getCourseLessonById)

// Admin-only endpoint for content-version comparisons on a lesson order slot.
coursesRouter.get(
	"/courses/:idOrSlug/lessons/:orderIndex/diff",
	requireCourseAdmin,
	getLessonVersionDiff,
)

coursesRouter.patch(
	"/courses/:idOrSlug/lessons/:orderIndex",
	requireCourseAdmin,
	updateLessonVersion,
)

coursesRouter.post("/courses", requireCourseAdmin, createCourse)
coursesRouter.patch("/courses/:id", requireCourseAdmin, updateCourse)
