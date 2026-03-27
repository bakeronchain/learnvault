import { Router, type Request, type Response } from "express"
import { z } from "zod"

import {
	getScholarMilestones,
	getScholarsLeaderboard,
	getScholarProfile,
} from "../controllers/scholars.controller"
import { pool } from "../db/index"
import { validate } from "../middleware/validate.middleware"

export const scholarsRouter = Router()

const scholarMilestonesParamsSchema = z.object({
	address: z.string().trim().min(1, "address is required"),
})

const scholarMilestonesQuerySchema = z.object({
	status: z.enum(["pending", "verified", "rejected", "approved"]).optional(),
	course_id: z.string().trim().min(1, "course_id cannot be empty").optional(),
})

const lrnHistoryParamsSchema = z.object({
	address: z.string().trim().min(1, "address is required"),
})

/**
 * @openapi
 * /api/scholars/{address}/milestones:
 *   get:
 *     tags: [Scholars]
 *     summary: Milestone history for a scholar
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema: { type: string }
 *         description: Scholar address
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [pending, verified, rejected]
 *       - in: query
 *         name: course_id
 *         required: false
 *         schema: { type: string }
 *         description: Course id (slug), e.g. stellar-basics
 *     responses:
 *       200:
 *         description: Milestone history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 milestones:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       course_id: { type: string }
 *                       milestone_id: { type: integer }
 *                       status: { type: string, enum: [pending, verified, rejected] }
 *                       evidence_url: { type: string, nullable: true }
 *                       submitted_at: { type: string, format: date-time, nullable: true }
 *                       verified_at: { type: string, format: date-time, nullable: true }
 *                       tx_hash: { type: string, nullable: true }
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
scholarsRouter.get(
	"/scholars/:address/milestones",
	validate({
		params: scholarMilestonesParamsSchema,
		query: scholarMilestonesQuerySchema,
	}),
	getScholarMilestones,
)

/**
 * @openapi
 * /api/scholars/{address}/lrn-history:
 *   get:
 *     tags: [Scholars]
 *     summary: LRN token mint history for a scholar
 *     description: >
 *       Returns a time-ordered list of LRN mint events derived from verified
 *       milestones, along with the running cumulative balance at each point.
 *       Useful for rendering a historical balance chart on the Profile page.
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema: { type: string }
 *         description: Scholar's Stellar public key
 *     responses:
 *       200:
 *         description: Array of LRN mint events sorted by timestamp
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 history:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       timestamp: { type: string, format: date-time }
 *                       amount:    { type: number, description: "LRN minted at this event" }
 *                       cumulative:{ type: number, description: "Running total LRN balance" }
 *                       course_id: { type: string }
 *                       tx_hash:   { type: string, nullable: true }
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
scholarsRouter.get(
	"/scholars/:address/lrn-history",
	validate({ params: lrnHistoryParamsSchema }),
	async (req: Request, res: Response) => {
		const { address } = req.params as { address: string }
		try {
			// Fetch verified milestones as LRN earning events.
			// Each verified milestone corresponds to a mint; lrn_amount stores the
			// token value if recorded, otherwise a sensible per-milestone default
			// (1 000 LRN stroops) is used.
			const result = await pool.query(
				`SELECT
           COALESCE(verified_at, submitted_at) AS timestamp,
           COALESCE(lrn_amount, 1000)          AS amount,
           course_id,
           tx_hash
         FROM scholar_milestones
         WHERE scholar_address = $1
           AND status = 'verified'
         ORDER BY timestamp ASC`,
				[address],
			)

			// Build cumulative series
			let cumulative = 0
			const history = result.rows.map(
				(row: {
					timestamp: string
					amount: number
					course_id: string
					tx_hash: string | null
				}) => {
					cumulative += Number(row.amount)
					return {
						timestamp: row.timestamp,
						amount: Number(row.amount),
						cumulative,
						course_id: row.course_id,
						tx_hash: row.tx_hash ?? null,
					}
				},
			)

			res.json({ history })
		} catch (err) {
			res.status(500).json({ error: "Failed to fetch LRN history" })
		}
	},
)

scholarsRouter.get("/scholars/leaderboard", (req, res) => {
	void getScholarsLeaderboard(req, res)
})

scholarsRouter.get("/scholars/:address", (req, res) => {
	void getScholarProfile(req, res)
})
