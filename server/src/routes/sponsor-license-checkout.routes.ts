import { Router } from "express"
import { type Pool } from "pg"
import { SponsorLicenseCheckoutController } from "../controllers/sponsor-license-checkout.controller"

export function createSponsorLicenseCheckoutRoutes(pool: Pool): Router {
	const router = Router()
	const controller = new SponsorLicenseCheckoutController(pool)

	// Create bulk license grants
	router.post("/", controller.create)

	// Get grants by sponsor organization
	router.get("/:walletAddress", controller.getByOrganization)

	// Get grants by recipient
	router.get("/recipient/:walletAddress", controller.getByRecipient)

	return router
}
