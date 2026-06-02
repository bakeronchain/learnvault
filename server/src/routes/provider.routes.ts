import { Router } from "express"
import {
	createWebhook,
	deleteWebhook,
	listDeliveries,
	listWebhooks,
} from "../controllers/provider-webhooks.controller"
import {
	getLrnBalance,
	listCompletions,
	listProviderCourses,
	reportCompletion,
	submitCourse,
} from "../controllers/provider.controller"
import {
	providerRateLimiter,
	requireProviderAuth,
	requireProviderScope,
} from "../middleware/provider-auth.middleware"

const router = Router()

// All provider routes require a valid API key and respect the per-key rate limit.
router.use(providerRateLimiter, requireProviderAuth)

// Courses
router.post(
	"/provider/courses",
	requireProviderScope("courses:write"),
	submitCourse,
)
router.get("/provider/courses", listProviderCourses)

// Completions
router.post(
	"/provider/completions",
	requireProviderScope("completions:write"),
	reportCompletion,
)
router.get("/provider/completions", listCompletions)

// LRN data
router.get(
	"/provider/lrn-balances/:address",
	requireProviderScope("lrn:read"),
	getLrnBalance,
)

// Webhooks
router.post(
	"/provider/webhooks",
	requireProviderScope("webhooks:write"),
	createWebhook,
)
router.get("/provider/webhooks", listWebhooks)
router.delete("/provider/webhooks/:id", deleteWebhook)
router.get("/provider/webhooks/:id/deliveries", listDeliveries)

export { router as providerRouter }
