import { Router, Request, Response } from "express"
import { badgeService } from "../services/badge.service"
import { badgeRulesService } from "../services/badge-rules.service"
import { logger } from "../lib/logger"

const router = Router()
const log = logger.child({ module: "badges-routes" })

/**
 * GET /api/badges/:address
 * Get all badges for a specific address
 */
router.get("/:address", async (req: Request, res: Response) => {
	try {
		const { address } = req.params

		if (!address) {
			return res.status(400).json({ error: "Address is required" })
		}

		const badges = await badgeService.getBadgesForAddress(address)
		const allBadgeTypes = await badgeService.getAllBadgeTypes()

		// Determine which badges are earned vs locked
		const earnedBadgeTypes = new Set(badges.map((b) => b.badge_type))
		const badgeCatalog = allBadgeTypes.map(({ badge_type, metadata }) => ({
			badge_type,
			metadata,
			earned: earnedBadgeTypes.has(badge_type),
			token_id: badges.find((b) => b.badge_type === badge_type)?.token_id || null,
			awarded_at: badges.find((b) => b.badge_type === badge_type)?.awarded_at || null,
		}))

		res.json({
			address,
			earned_badges: badges,
			badge_catalog: badgeCatalog,
		})
	} catch (error) {
		log.error({ error, address: req.params.address }, "Error fetching badges")
		res.status(500).json({ error: "Failed to fetch badges" })
	}
})

/**
 * POST /api/badges/evaluate/:address
 * Evaluate badge rules for an address (doesn't mint, just checks eligibility)
 */
router.post("/evaluate/:address", async (req: Request, res: Response) => {
	try {
		const { address } = req.params

		if (!address) {
			return res.status(400).json({ error: "Address is required" })
		}

		const evaluations = await badgeRulesService.evaluateBadgeRules(address)

		res.json({
			address,
			evaluations,
		})
	} catch (error) {
		log.error({ error, address: req.params.address }, "Error evaluating badge rules")
		res.status(500).json({ error: "Failed to evaluate badge rules" })
	}
})

/**
 * POST /api/badges/award/:address
 * Process and award badges for an address based on rule evaluation
 * This is idempotent - won't award if already has badge
 */
router.post("/award/:address", async (req: Request, res: Response) => {
	try {
		const { address } = req.params

		if (!address) {
			return res.status(400).json({ error: "Address is required" })
		}

		const result = await badgeRulesService.processBadgeAwards(address)

		res.json({
			address,
			awarded: result.awarded,
			skipped: result.skipped,
		})
	} catch (error) {
		log.error({ error, address: req.params.address }, "Error awarding badges")
		res.status(500).json({ error: "Failed to award badges" })
	}
})

/**
 * GET /api/badges/catalog
 * Get all available badge types with metadata
 */
router.get("/catalog", async (_req: Request, res: Response) => {
	try {
		const catalog = await badgeService.getAllBadgeTypes()
		res.json({ catalog })
	} catch (error) {
		log.error({ error }, "Error fetching badge catalog")
		res.status(500).json({ error: "Failed to fetch badge catalog" })
	}
})

/**
 * POST /api/badges/check/:address/:badgeType
 * Check if an address has a specific badge
 */
router.get("/check/:address/:badgeType", async (req: Request, res: Response) => {
	try {
		const { address, badgeType } = req.params

		if (!address || !badgeType) {
			return res.status(400).json({ error: "Address and badge type are required" })
		}

		const hasBadge = await badgeService.hasBadge(address, badgeType)

		res.json({
			address,
			badge_type: badgeType,
			has_badge: hasBadge,
		})
	} catch (error) {
		log.error(
			{ error, address: req.params.address, badgeType: req.params.badgeType },
			"Error checking badge",
		)
		res.status(500).json({ error: "Failed to check badge" })
	}
})

export default router
