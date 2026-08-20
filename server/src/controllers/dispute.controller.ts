import { type Request, type Response } from "express"
import { disputeStore, type DisputePhase } from "../db/dispute-store"
import { logger } from "../lib/logger"
import { type AuthRequest } from "../middleware/auth.middleware"

const log = logger.child({ module: "dispute" })

const VALID_PHASES: DisputePhase[] = ["active", "resolved", "quorum_failed"]

/**
 * GET /api/disputes
 * List arbitration disputes, optionally filtered by phase.
 */
export async function listDisputes(req: Request, res: Response): Promise<void> {
	try {
		const phase =
			typeof req.query.phase === "string"
				? (req.query.phase as DisputePhase)
				: undefined
		const page = Number.parseInt(String(req.query.page ?? ""), 10) || 1
		const pageSize = Number.parseInt(String(req.query.pageSize ?? ""), 10) || 20

		if (phase && !VALID_PHASES.includes(phase)) {
			res.status(400).json({ error: "Invalid phase filter" })
			return
		}

		const result = await disputeStore.listDisputes({ phase, page, pageSize })

		res.status(200).json({
			data: result.data,
			pagination: {
				page,
				pageSize,
				total: result.total,
				totalPages: Math.ceil(result.total / pageSize),
			},
		})
	} catch (err) {
		log.error({ err }, "Failed to list disputes")
		res.status(500).json({ error: "Failed to list disputes" })
	}
}

/**
 * GET /api/disputes/:id
 * Fetch one dispute, including its panel and any revealed votes.
 */
export async function getDisputeById(
	req: Request,
	res: Response,
): Promise<void> {
	try {
		const disputeId = req.params.id
		if (!disputeId || !/^\d+$/.test(disputeId)) {
			res.status(400).json({ error: "Invalid dispute id" })
			return
		}

		const dispute = await disputeStore.getDisputeById(disputeId)
		if (!dispute) {
			res.status(404).json({ error: "Dispute not found" })
			return
		}

		const [jurors, votes] = await Promise.all([
			disputeStore.getJurorsForDispute(disputeId),
			disputeStore.getVotesForDispute(disputeId),
		])

		res.status(200).json({ data: { ...dispute, jurors, votes } })
	} catch (err) {
		log.error({ err }, "Failed to fetch dispute")
		res.status(500).json({ error: "Failed to fetch dispute" })
	}
}

/**
 * GET /api/disputes/juror/:address
 * Every dispute a given wallet address has been drawn onto a panel for.
 */
export async function getJurorAssignments(
	req: Request,
	res: Response,
): Promise<void> {
	try {
		const address = req.params.address
		if (!address) {
			res.status(400).json({ error: "Invalid juror address" })
			return
		}

		const assignments = await disputeStore.getAssignmentsForJuror(address)
		res.status(200).json({ data: assignments })
	} catch (err) {
		log.error({ err }, "Failed to fetch juror assignments")
		res.status(500).json({ error: "Failed to fetch juror assignments" })
	}
}

/**
 * POST /api/disputes/pending-evidence
 * Register an IPFS evidence CID for a not-yet-opened dispute, keyed by
 * (proposalId, milestoneId). Call this *before* signing `open_dispute`
 * on-chain -- the chain only ever receives the evidence hash, and the
 * indexer attaches this CID to the dispute row once it observes the
 * DisputeOpened event for the same (proposalId, milestoneId) pair.
 */
export async function registerPendingEvidence(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	try {
		const scholarAddress = req.user?.address
		if (!scholarAddress) {
			res.status(401).json({ error: "Unauthorized" })
			return
		}

		const { proposalId, milestoneId, evidenceIpfsCid } = req.body as {
			proposalId?: unknown
			milestoneId?: unknown
			evidenceIpfsCid?: unknown
		}
		const parsedProposalId = Number(proposalId)
		const parsedMilestoneId = Number(milestoneId)
		if (
			!Number.isFinite(parsedProposalId) ||
			!Number.isFinite(parsedMilestoneId)
		) {
			res.status(400).json({ error: "proposalId and milestoneId are required" })
			return
		}
		if (typeof evidenceIpfsCid !== "string" || !evidenceIpfsCid.trim()) {
			res.status(400).json({ error: "evidenceIpfsCid is required" })
			return
		}

		await disputeStore.setPendingEvidence({
			proposalId: parsedProposalId,
			milestoneId: parsedMilestoneId,
			scholarAddress,
			evidenceIpfsCid: evidenceIpfsCid.trim(),
		})

		res
			.status(200)
			.json({
				data: { proposalId: parsedProposalId, milestoneId: parsedMilestoneId },
			})
	} catch (err) {
		log.error({ err }, "Failed to register pending dispute evidence")
		res
			.status(500)
			.json({ error: "Failed to register pending dispute evidence" })
	}
}

/**
 * GET /api/disputes/milestone/:proposalId/:milestoneId
 * Look up the dispute (if any) already opened for a specific milestone.
 */
export async function getDisputeByMilestone(
	req: Request,
	res: Response,
): Promise<void> {
	try {
		const proposalId = Number.parseInt(req.params.proposalId ?? "", 10)
		const milestoneId = Number.parseInt(req.params.milestoneId ?? "", 10)
		if (!Number.isFinite(proposalId) || !Number.isFinite(milestoneId)) {
			res.status(400).json({ error: "Invalid proposal or milestone id" })
			return
		}

		const dispute = await disputeStore.getDisputeByMilestone(
			proposalId,
			milestoneId,
		)
		res.status(200).json({ data: dispute })
	} catch (err) {
		log.error({ err }, "Failed to look up dispute for milestone")
		res.status(500).json({ error: "Failed to look up dispute for milestone" })
	}
}
