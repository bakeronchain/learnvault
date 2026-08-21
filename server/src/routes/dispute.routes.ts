import { Router } from "express"
import {
	getDisputeById,
	getDisputeByMilestone,
	getJurorAssignments,
	listDisputes,
	registerPendingEvidence,
} from "../controllers/dispute.controller"
import {
	type AuthRequest,
	createRequireAuth,
} from "../middleware/auth.middleware"
import { type JwtService } from "../services/jwt.service"

export function createDisputeRouter(jwtService: JwtService): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)

	/**
	 * @openapi
	 * /api/disputes:
	 *   get:
	 *     tags: [Disputes]
	 *     summary: List milestone arbitration disputes
	 *     description: >
	 *       Reads the off-chain index of on-chain milestone_arbitration disputes.
	 *       Filter by phase to find open disputes needing jurors.
	 *     parameters:
	 *       - in: query
	 *         name: phase
	 *         schema:
	 *           type: string
	 *           enum: [active, resolved, quorum_failed]
	 *       - in: query
	 *         name: page
	 *         schema: { type: integer }
	 *       - in: query
	 *         name: pageSize
	 *         schema: { type: integer }
	 *     responses:
	 *       200:
	 *         description: Paginated list of disputes
	 */
	router.get("/disputes", (req, res) => {
		void listDisputes(req, res)
	})

	/**
	 * @openapi
	 * /api/disputes/juror/{address}:
	 *   get:
	 *     tags: [Disputes]
	 *     summary: List a juror's dispute panel assignments
	 *     parameters:
	 *       - in: path
	 *         name: address
	 *         required: true
	 *         schema: { type: string }
	 *     responses:
	 *       200:
	 *         description: Disputes this address has been drawn onto a panel for
	 */
	router.get("/disputes/juror/:address", (req, res) => {
		void getJurorAssignments(req, res)
	})

	/**
	 * @openapi
	 * /api/disputes/milestone/{proposalId}/{milestoneId}:
	 *   get:
	 *     tags: [Disputes]
	 *     summary: Look up the dispute (if any) opened for a specific milestone
	 *     parameters:
	 *       - in: path
	 *         name: proposalId
	 *         required: true
	 *         schema: { type: integer }
	 *       - in: path
	 *         name: milestoneId
	 *         required: true
	 *         schema: { type: integer }
	 *     responses:
	 *       200:
	 *         description: The dispute for this milestone, or null
	 */
	router.get("/disputes/milestone/:proposalId/:milestoneId", (req, res) => {
		void getDisputeByMilestone(req, res)
	})

	/**
	 * @openapi
	 * /api/disputes/pending-evidence:
	 *   post:
	 *     tags: [Disputes]
	 *     summary: Register an IPFS evidence CID before opening a dispute on-chain
	 *     description: >
	 *       Call after uploading evidence to IPFS (via POST /api/upload) and
	 *       before signing `open_dispute`. Only the evidence hash is ever
	 *       written on-chain; the indexer attaches this CID to the dispute
	 *       once it observes the matching DisputeOpened event.
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required: [proposalId, milestoneId, evidenceIpfsCid]
	 *             properties:
	 *               proposalId: { type: integer }
	 *               milestoneId: { type: integer }
	 *               evidenceIpfsCid: { type: string }
	 *     responses:
	 *       200:
	 *         description: Evidence CID registered
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 */
	router.post("/disputes/pending-evidence", requireAuth, (req, res) => {
		void registerPendingEvidence(req as AuthRequest, res)
	})

	/**
	 * @openapi
	 * /api/disputes/{id}:
	 *   get:
	 *     tags: [Disputes]
	 *     summary: Fetch one dispute, its panel, and any revealed votes
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema: { type: string }
	 *     responses:
	 *       200:
	 *         description: Dispute detail
	 *       404:
	 *         $ref: '#/components/responses/NotFoundError'
	 */
	router.get("/disputes/:id", (req, res) => {
		void getDisputeById(req, res)
	})

	return router
}
