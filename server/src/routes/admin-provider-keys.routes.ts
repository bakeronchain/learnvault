import { Router } from "express"
import {
	createKey,
	listKeys,
	patchKey,
	revokeKey,
} from "../controllers/admin-provider-keys.controller"
import { requireAdmin } from "../middleware/admin.middleware"

const router = Router()

router.use(requireAdmin)

router.post("/admin/provider-keys", createKey)
router.get("/admin/provider-keys", listKeys)
router.patch("/admin/provider-keys/:id", patchKey)
router.delete("/admin/provider-keys/:id", revokeKey)

export { router as adminProviderKeysRouter }
