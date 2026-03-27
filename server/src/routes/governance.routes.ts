import { Router } from "express"

import { getGovernanceProposals } from "../controllers/governance.controller"

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
