import { Router } from "express"

import {
	castVote,
	createGovernanceProposal,
	getGovernanceProposalById,
	getGovernanceProposals,
	getVotingPower,
} from "../controllers/governance.controller"

export const governanceRouter = Router()

/**
 * @openapi
 * /api/governance/proposals:
 *   get:
 *     tags: [Governance]
 *     summary: List governance proposals
 *     description: Returns a paginated list of governance proposals, optionally filtered by status.
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         description: Filter proposals by status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of proposals per page
 *     responses:
 *       200:
 *         description: Paginated list of proposals
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 proposals:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Proposal'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
governanceRouter.get("/governance/proposals", (req, res) => {
	void getGovernanceProposals(req, res)
})

governanceRouter.get("/proposals", (req, res) => {
	void getGovernanceProposals(req, res)
})

/**
 * @openapi
 * /api/governance/proposals:
 *   post:
 *     tags: [Governance]
 *     summary: Create a governance proposal
 *     description: |
 *       Submits a new governance proposal on-chain via the ScholarshipTreasury contract
 *       and records it in the database. Generates a 3-milestone program automatically.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GovernanceProposalInput'
 *           example:
 *             author_address: "GABCD123456789..."
 *             title: "Fund blockchain education program"
 *             description: "A comprehensive program to teach blockchain development fundamentals."
 *             requested_amount: "1000"
 *             evidence_url: "https://github.com/example/proposal"
 *     responses:
 *       201:
 *         description: Proposal created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GovernanceProposalCreated'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
governanceRouter.post("/governance/proposals", (req, res) => {
	void createGovernanceProposal(req, res)
})

governanceRouter.post("/proposals", (req, res) => {
	void createGovernanceProposal(req, res)
})

governanceRouter.get("/governance/proposals/:id", (req, res) => {
	void getGovernanceProposalById(req, res)
})

governanceRouter.get("/proposals/:id", (req, res) => {
	void getGovernanceProposalById(req, res)
})

/**
 * @openapi
 * /api/governance/voting-power/{address}:
 *   get:
 *     tags: [Governance]
 *     summary: Get voting power for an address
 *     description: Returns the governance token balance and voting eligibility for the given Stellar address.
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 50
 *         description: Stellar wallet address
 *     responses:
 *       200:
 *         description: Voting power details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VotingPower'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
governanceRouter.get("/governance/voting-power/:address", (req, res) => {
	void getVotingPower(req, res)
})

governanceRouter.post("/governance/vote", (req, res) => {
	void castVote(req, res)
})
