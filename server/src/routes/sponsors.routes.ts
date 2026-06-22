import { Router } from "express"
import { SponsorLicenseCheckoutController } from "../controllers/sponsor-license-checkout.controller"
import {
	createTrackSponsorship,
	getOrganizationDashboard,
	getOrganizationProfile,
	getOrganizationQuarterlyReport,
	getTrackSponsorLogos,
	upsertOrganizationProfile,
	upsertScholarRegion,
} from "../controllers/sponsors.controller"
import { getPool } from "../db/index"

export const sponsorsRouter = Router()
const licenseCheckoutController = new SponsorLicenseCheckoutController(
	getPool(),
)

sponsorsRouter.get("/sponsors/organizations/:walletAddress", (req, res) => {
	void getOrganizationProfile(req, res)
})

sponsorsRouter.put("/sponsors/organizations/:walletAddress", (req, res) => {
	void upsertOrganizationProfile(req, res)
})

sponsorsRouter.post("/sponsors/sponsorships", (req, res) => {
	void createTrackSponsorship(req, res)
})

sponsorsRouter.get("/sponsors/logos", (req, res) => {
	void getTrackSponsorLogos(req, res)
})

sponsorsRouter.get(
	"/sponsors/organizations/:walletAddress/dashboard",
	(req, res) => {
		void getOrganizationDashboard(req, res)
	},
)

sponsorsRouter.get(
	"/sponsors/organizations/:walletAddress/reports/quarterly",
	(req, res) => {
		void getOrganizationQuarterlyReport(req, res)
	},
)

sponsorsRouter.put("/sponsors/scholar-region", (req, res) => {
	void upsertScholarRegion(req, res)
})

// Bulk license checkout endpoints
sponsorsRouter.post("/sponsors/license-checkout", (req, res) => {
	void licenseCheckoutController.create(req, res)
})

sponsorsRouter.get("/sponsors/license-checkout/:walletAddress", (req, res) => {
	void licenseCheckoutController.getByOrganization(req, res)
})

sponsorsRouter.get(
	"/sponsors/license-checkout/recipient/:walletAddress",
	(req, res) => {
		void licenseCheckoutController.getByRecipient(req, res)
	},
)
