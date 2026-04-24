import { Router } from "express"
import { getEvents, createEvent } from "../controllers/community.controller"

const router = Router()

router.get("/events", getEvents)
router.post("/events", createEvent)

export { router as communityRouter }
