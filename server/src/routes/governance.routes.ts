import { Router } from "express"

import {
	castVote,
	createGovernanceProposal,
	getGovernanceProposals,
	getVotingPower,
} from "../controllers/governance.controller"

export const governanceRouter = Router()

governanceRouter.get("/governance/proposals", (req, res) => {
	void getGovernanceProposals(req, res)
})

governanceRouter.post("/governance/proposals", (req, res) => {
	void createGovernanceProposal(req, res)
})

governanceRouter.get("/governance/voting-power/:address", (req, res) => {
	void getVotingPower(req, res)
})

governanceRouter.post("/governance/vote", (req, res) => {
	void castVote(req, res)
})
