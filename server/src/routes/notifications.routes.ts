import { Router } from "express"

import {
	getNotifications,
	getPreferences,
	markAllRead,
	markManyRead,
	markOneRead,
	subscribePush,
	unsubscribePush,
	updatePreferences,
} from "../controllers/notifications.controller"
import { authMiddleware } from "../middleware/auth.middleware"
import type { AuthRequest } from "../middleware/auth.middleware"
import { type Response } from "express"

export const notificationsRouter = Router()

notificationsRouter.get(
	"/notifications",
	authMiddleware,
	(req, res) => {
		void getNotifications(req as AuthRequest, res as Response)
	},
)

/**
 * @openapi
 * /api/notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Number of notifications updated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
notificationsRouter.patch(
	"/notifications/read-all",
	authMiddleware,
	(req, res) => {
		void markAllRead(req as AuthRequest, res as Response)
	},
)

/**
 * @openapi
 * /api/notifications/read:
 *   put:
 *     tags: [Notifications]
 *     summary: Bulk-mark a list of notifications as read
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 items: { type: integer }
 *     responses:
 *       200:
 *         description: Number of notifications updated
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
notificationsRouter.put("/notifications/read", authMiddleware, (req, res) => {
	void markManyRead(req as AuthRequest, res as Response)
})

/**
 * @openapi
 * /api/notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark a single notification as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
notificationsRouter.patch(
	"/notifications/:id/read",
	authMiddleware,
	(req, res) => {
		void markOneRead(req as AuthRequest, res as Response)
	},
)

notificationsRouter.post("/notifications/subscribe", authMiddleware, (req, res) => {
	void subscribePush(req as AuthRequest, res as Response)
})

notificationsRouter.delete(
	"/notifications/subscribe",
	authMiddleware,
	(req, res) => {
		void unsubscribePush(req as AuthRequest, res as Response)
	},
)

notificationsRouter.get("/notifications/preferences", authMiddleware, (req, res) => {
	void getPreferences(req as AuthRequest, res as Response)
})

notificationsRouter.patch(
	"/notifications/preferences",
	authMiddleware,
	(req, res) => {
		void updatePreferences(req as AuthRequest, res as Response)
	},
)
