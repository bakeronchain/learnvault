import { Router } from "express"
import {
	createTrackSponsorship,
	getOrganizationDashboard,
	getOrganizationProfile,
	getOrganizationQuarterlyReport,
	getTrackSponsorLogos,
	upsertOrganizationProfile,
	upsertScholarRegion,
} from "../controllers/sponsors.controller"

export const sponsorsRouter = Router()

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
