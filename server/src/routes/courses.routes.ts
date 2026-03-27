import { Router } from "express"

import {
	createCourse,
	getCourse,
	getCourseLessonById,
	getCourses,
	updateCourse,
} from "../controllers/courses.controller"
import { requireCourseAdmin } from "../middleware/course-admin.middleware"

export const coursesRouter = Router()

coursesRouter.get("/courses", getCourses)
coursesRouter.get("/courses/:idOrSlug", getCourse)
coursesRouter.get("/courses/:idOrSlug/lessons/:id", getCourseLessonById)
coursesRouter.post("/courses", requireCourseAdmin, createCourse)
coursesRouter.patch("/courses/:id", requireCourseAdmin, updateCourse)
