import { Router } from "express"

import {
	getNotifications,
	markAllRead,
	markOneRead,
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

notificationsRouter.patch(
	"/notifications/read-all",
	authMiddleware,
	(req, res) => {
		void markAllRead(req as AuthRequest, res as Response)
	},
)

notificationsRouter.patch(
	"/notifications/:id/read",
	authMiddleware,
	(req, res) => {
		void markOneRead(req as AuthRequest, res as Response)
	},
)
