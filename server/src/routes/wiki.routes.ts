import { Router } from "express"
import * as wikiController from "../controllers/wiki.controller"
import { requireAdmin } from "../middleware/admin.middleware"

export const wikiRouter = Router()

// Public routes
wikiRouter.get("/", wikiController.getWikiPages)
wikiRouter.get("/:slug", wikiController.getWikiPageBySlug)

// Admin routes
wikiRouter.post("/", requireAdmin, wikiController.createWikiPage)
wikiRouter.put("/:id", requireAdmin, wikiController.updateWikiPage)
wikiRouter.delete("/:id", requireAdmin, wikiController.deleteWikiPage)
