import { Router } from "express"

import {
	createBookmark,
	deleteBookmark,
	listBookmarks,
} from "../controllers/bookmarks.controller"
import * as schemas from "../lib/zod-schemas"
import { createRequireAuth } from "../middleware/auth.middleware"
import { validate } from "../middleware/validation.middleware"
import { type JwtService } from "../services/jwt.service"

/**
 * Bookmarks (a.k.a. "wishlist") let an authenticated learner save courses
 * for later. Address always comes from the JWT — never from the body or URL.
 */
export function createBookmarksRouter(jwtService: JwtService): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)

	/**
	 * @openapi
	 * /api/me/bookmarks:
	 *   get:
	 *     tags: [Bookmarks]
	 *     summary: List the authenticated learner's bookmarked courses
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Bookmarks fetched successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 data:
	 *                   type: array
	 *                   items:
	 *                     type: object
	 *                     properties:
	 *                       bookmark_id: { type: integer }
	 *                       course_id: { type: string }
	 *                       created_at: { type: string, format: date-time }
	 *       401:
	 *         description: Unauthorized
	 */
	router.get("/me/bookmarks", requireAuth, listBookmarks)

	/**
	 * @openapi
	 * /api/me/bookmarks:
	 *   post:
	 *     tags: [Bookmarks]
	 *     summary: Bookmark a course
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required: [course_id]
	 *             properties:
	 *               course_id: { type: string }
	 *     responses:
	 *       201:
	 *         description: Bookmark created
	 *       200:
	 *         description: Bookmark already existed (idempotent)
	 *       400:
	 *         description: Validation error
	 *       401:
	 *         description: Unauthorized
	 */
	router.post(
		"/me/bookmarks",
		requireAuth,
		validate({ body: schemas.bookmarkBodySchema }),
		createBookmark,
	)

	/**
	 * @openapi
	 * /api/me/bookmarks/{courseId}:
	 *   delete:
	 *     tags: [Bookmarks]
	 *     summary: Remove a bookmark (idempotent)
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: courseId
	 *         required: true
	 *         schema: { type: string }
	 *     responses:
	 *       204:
	 *         description: Bookmark removed (or did not exist)
	 *       400:
	 *         description: Validation error
	 *       401:
	 *         description: Unauthorized
	 */
	router.delete(
		"/me/bookmarks/:courseId",
		requireAuth,
		validate({ params: schemas.bookmarkCourseIdParamSchema }),
		deleteBookmark,
	)

	return router
}
