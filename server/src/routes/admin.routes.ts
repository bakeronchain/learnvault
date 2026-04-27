import { Router } from "express"

import { getAdminStats } from "../controllers/admin.controller"
import { bulkImportCourses } from "../controllers/admin-courses.controller"
import { requireAdmin } from "../middleware/admin.middleware"

export const adminRouter = Router()

adminRouter.get("/admin/stats", requireAdmin, getAdminStats)

/**
 * @openapi
 * /api/admin/courses/bulk-import:
 *   post:
 *     summary: Bulk import courses for admin users
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 properties:
 *                   courses:
 *                     type: array
 *                     items:
 *                       $ref: '#/components/schemas/CourseImportRow'
 *                   preview:
 *                     type: boolean
 *               - type: object
 *                 properties:
 *                   csv:
 *                     type: string
 *                     description: CSV payload with headers
 *                   preview:
 *                     type: boolean
 *         text/csv:
 *           schema:
 *             type: string
 *           example: |
 *             title,slug,track,difficulty,description,coverImage,published
 *             Stellar Basics,stellar-basics,Beginner,Beginner,"A starter course",,true
 *     responses:
 *       200:
 *         description: Bulk import preview or confirmation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 imported:
 *                   type: integer
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       row:
 *                         type: integer
 *                       slug:
 *                         type: string
 *                       success:
 *                         type: boolean
 *                       errors:
 *                         type: array
 *                         items:
 *                           type: string
 *                       course:
 *                         type: object
 *                         nullable: true
 */
adminRouter.post(
	"/admin/courses/bulk-import",
	requireAdmin,
	bulkImportCourses,
)
