import { Router } from "express"
import {
	getImpactWidgetData,
	getPublicImpactMetrics,
} from "../controllers/impact.controller"

export const impactRouter = Router()

impactRouter.get("/impact/metrics", (req, res) => {
	void getPublicImpactMetrics(req, res)
})

impactRouter.get("/impact/widget", (req, res) => {
	void getImpactWidgetData(req, res)
})
