import { Router } from "express"

import { getGovernanceProposals } from "../controllers/governance.controller"

export const governanceRouter = Router()

governanceRouter.get("/governance/proposals", (req, res) => {
	void getGovernanceProposals(req, res)
})
