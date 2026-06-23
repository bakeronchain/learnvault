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
	generateCertificate,
	verifyCertificate,
} from "../controllers/certificates.controller"
import {
	requireCourseAdmin,
	requireCourseAdminIfRequested,
} from "../middleware/course-admin.middleware"
import { createRequireAuth } from "../middleware/auth.middleware"
import { apiResponseCache } from "../middleware/api-response-cache.middleware"
import { type JwtService } from "../services/jwt.service"

export function createCoursesRouter(jwtService: JwtService): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)

	router.get(
		"/courses",
		requireCourseAdminIfRequested,
		apiResponseCache("courses"),
		getCourses,
	)
	router.get("/courses/:idOrSlug", getCourse)
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
	router.get(
		"/courses/:courseId/certificate",
		requireAuth,
		generateCertificate,
	)
	router.get("/certificates/:certificateId/verify", verifyCertificate)

	return router
}

/** @deprecated Use createCoursesRouter(jwtService) instead */
export const coursesRouter = Router()


