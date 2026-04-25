import { Router } from "express"

import { getAdminStats } from "../controllers/admin.controller"
import { requireAdmin } from "../middleware/admin.middleware"

export const adminRouter = Router()

adminRouter.get("/admin/stats", requireAdmin, getAdminStats)
