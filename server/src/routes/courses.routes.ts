import { Router } from "express"

import {
	createCourse,
	getCourseBySlug,
	getCourseLessonById,
	getCourses,
	updateCourse,
} from "../controllers/courses.controller"
import { requireCourseAdmin } from "../middleware/course-admin.middleware"

export const coursesRouter = Router()

coursesRouter.get("/courses", getCourses)
coursesRouter.get("/courses/:slug", getCourseBySlug)
coursesRouter.get("/courses/:slug/lessons/:id", getCourseLessonById)
coursesRouter.post("/courses", requireCourseAdmin, createCourse)
coursesRouter.put("/courses/:id", requireCourseAdmin, updateCourse)
