import { Router } from "express"

import {
	createGovernanceProposal,
	getGovernanceProposals,
} from "../controllers/governance.controller"

export const governanceRouter = Router()

governanceRouter.get("/governance/proposals", (req, res) => {
	void getGovernanceProposals(req, res)
})

governanceRouter.post("/governance/proposals", (req, res) => {
	void createGovernanceProposal(req, res)
})
