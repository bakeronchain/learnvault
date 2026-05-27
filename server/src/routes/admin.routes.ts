import { Router } from "express"

import { getAdminStats } from "../controllers/admin.controller"
import { getAdminAnalytics } from "../controllers/admin-analytics.controller"
import { bulkImportCourses } from "../controllers/admin-courses.controller"
import { requireAdmin } from "../middleware/admin.middleware"

export const adminRouter = Router()

adminRouter.get("/admin/stats", requireAdmin, getAdminStats)

/**
 * @openapi
 * /api/admin/analytics:
 *   get:
 *     summary: Aggregate platform analytics for admin dashboard
 *     description: |
 *       Returns headline totals (users, enrollments, milestones, LRN minted, active scholars)
 *       plus 30-day time-series for charts. Cached server-side with a short TTL.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totals:
 *                   type: object
 *                   properties:
 *                     total_users:
 *                       type: integer
 *                       description: Unique addresses across enrollments, milestone reports, and scholar balances
 *                     enrollments_this_week:
 *                       type: integer
 *                     enrollments_this_month:
 *                       type: integer
 *                     milestones_submitted:
 *                       type: integer
 *                     milestones_approved:
 *                       type: integer
 *                     milestones_rejected:
 *                       type: integer
 *                     total_lrn_minted:
 *                       type: string
 *                       description: Sum of LRN balances as a stringified integer
 *                     active_scholars:
 *                       type: integer
 *                       description: Distinct scholars who submitted a milestone in the last 30 days
 *                 time_series:
 *                   type: object
 *                   properties:
 *                     daily_active_users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           day:
 *                             type: string
 *                             format: date
 *                           active_users:
 *                             type: integer
 *                     milestones_per_day:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           day:
 *                             type: string
 *                             format: date
 *                           submitted:
 *                             type: integer
 *                           approved:
 *                             type: integer
 *                           rejected:
 *                             type: integer
 *                 generated_at:
 *                   type: string
 *                   format: date-time
 *                 cache_ttl_seconds:
 *                   type: integer
 *       401:
 *         description: Missing or invalid admin token
 *       403:
 *         description: Authenticated address is not in the admin allowlist
 *       500:
 *         description: Unexpected server error
 */
adminRouter.get("/admin/analytics", requireAdmin, getAdminAnalytics)

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
