import { Router } from "express"

import {
	getDonorImpact,
} from "../controllers/donors.controller"

export const donorsRouter = Router()

/**
 * @openapi
 * /api/donors/{address}/impact:
 *   get:
 *     tags: [Donors]
 *     summary: Get donor impact statistics
 *     description: Returns impact metrics for a specific donor including total donated, scholars funded, milestones completed by funded scholars, and average completion rate
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Donor's Stellar wallet address
 *     responses:
 *       200:
 *         description: Donor impact statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_donated_usdc:
 *                   type: string
 *                   description: Total USDC donated by this donor (in stroops)
 *                   example: "500000000"
 *                 scholars_funded:
 *                   type: integer
 *                   description: Number of unique scholars funded by this donor
 *                   example: 5
 *                 milestones_completed:
 *                   type: integer
 *                   description: Total milestones completed by scholars funded by this donor
 *                   example: 12
 *                 average_completion_rate:
 *                   type: number
 *                   format: float
 *                   description: Average milestone completion rate for scholars funded by this donor (0-1)
 *                   example: 0.85
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *       503:
 *         description: Treasury contract not configured
 */
donorsRouter.get("/donors/:address/impact", (req, res) => {
	void getDonorImpact(req, res)
})
