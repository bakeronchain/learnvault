import { Router } from "express"

import { getAdminStats, postRotateAdminKey } from "../controllers/admin.controller"
import { rotateAdminApiKeyBodySchema } from "../lib/zod-schemas"
import { requireAdmin } from "../middleware/admin.middleware"
import { validate } from "../middleware/validate.middleware"

export const adminRouter = Router()

adminRouter.get("/admin/stats", requireAdmin, getAdminStats)
adminRouter.post(
	"/admin/rotate-key",
	requireAdmin,
	validate({
		body: rotateAdminApiKeyBodySchema,
	}),
	postRotateAdminKey,
)
