import { type Request, type Response } from "express"
import { bountyStore, type BountyStatus } from "../db/bounty-store"
import { logger } from "../lib/logger"
import {
	verifyEscrowDeposit,
	releaseEscrow,
	mintLrnReward,
	isValidTransition,
} from "../services/bounty.service"

const log = logger.child({ module: "bounty-controller" })

function normalizeAddress(addr: unknown): string | null {
	if (typeof addr !== "string") return null
	const trimmed = addr.trim()
	return trimmed.length > 0 ? trimmed.toLowerCase() : null
}

export async function listBounties(
	req: Request,
	res: Response,
): Promise<void> {
	try {
		const skill = typeof req.query.skill === "string" ? req.query.skill : undefined
		const status = typeof req.query.status === "string"
			? (req.query.status as BountyStatus)
			: undefined
		const page = Number.parseInt(String(req.query.page ?? ""), 10) || 1
		const pageSize = Number.parseInt(String(req.query.pageSize ?? ""), 10) || 20

		if (status && !["open", "claimed", "submitted", "approved", "paid", "cancelled"].includes(status)) {
			res.status(400).json({ error: "Invalid status filter" })
			return
		}

		const result = await bountyStore.listBounties({
			skill,
			status,
			page,
			pageSize,
		})

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
		log.error({ err }, "Failed to list bounties")
		res.status(500).json({ error: "Failed to list bounties" })
	}
}

export async function getBountyById(
	req: Request,
	res: Response,
): Promise<void> {
	try {
		const id = Number.parseInt(req.params.id ?? "", 10)
		if (!Number.isFinite(id) || id <= 0) {
			res.status(400).json({ error: "Invalid bounty ID" })
			return
		}

		const bounty = await bountyStore.getBountyById(id)
		if (!bounty) {
			res.status(404).json({ error: "Bounty not found" })
			return
		}

		let submission = null
		if (bounty.status === "submitted" || bounty.status === "approved" || bounty.status === "paid") {
			submission = await bountyStore.getSubmissionByBounty(id)
		}

		res.status(200).json({ bounty, submission })
	} catch (err) {
		log.error({ err }, "Failed to get bounty")
		res.status(500).json({ error: "Failed to get bounty" })
	}
}

export async function createBounty(
	req: Request,
	res: Response,
): Promise<void> {
	try {
		const walletAddress = normalizeAddress(
			(req as any).user?.address ?? (req as any).walletAddress,
		)
		if (!walletAddress) {
			res.status(401).json({ error: "Authentication required" })
			return
		}

		const { title, description, skillTags, rewardUsdc, escrowTx, claimDurationHours } =
			req.body as {
				title?: string
				description?: string
				skillTags?: string[]
				rewardUsdc?: string
				escrowTx?: string
				claimDurationHours?: number
			}

		if (!title || title.trim().length < 5 || title.trim().length > 200) {
			res.status(400).json({ error: "Title must be between 5 and 200 characters" })
			return
		}
		if (!description || description.trim().length < 20 || description.trim().length > 5000) {
			res.status(400).json({ error: "Description must be between 20 and 5000 characters" })
			return
		}
		const tags = Array.isArray(skillTags)
			? skillTags.filter((t) => typeof t === "string" && t.trim().length > 0).map((t) => t.trim().toLowerCase())
			: []
		if (tags.length > 10) {
			res.status(400).json({ error: "Maximum 10 skill tags allowed" })
			return
		}
		const rewardNum = Number.parseFloat(String(rewardUsdc))
		if (!Number.isFinite(rewardNum) || rewardNum <= 0) {
			res.status(400).json({ error: "Reward must be a positive number" })
			return
		}
		if (!escrowTx || escrowTx.trim().length === 0) {
			res.status(400).json({ error: "Escrow transaction hash is required" })
			return
		}

		const verification = await verifyEscrowDeposit(
			escrowTx.trim(),
			walletAddress,
			rewardNum,
		)
		if (!verification.valid) {
			res.status(400).json({ error: verification.reason })
			return
		}

		const hours = Number.isFinite(Number(claimDurationHours)) && Number(claimDurationHours) > 0
			? Number(claimDurationHours)
			: 72
		const deadline = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()

		const bounty = await bountyStore.createBounty({
			sponsor_addr: walletAddress,
			title: title.trim(),
			description: description.trim(),
			skill_tags: tags,
			reward_usdc: String(rewardNum),
			escrow_tx: escrowTx.trim(),
			deadline,
		})

		res.status(201).json({ bounty })
	} catch (err) {
		log.error({ err }, "Failed to create bounty")
		res.status(500).json({ error: "Failed to create bounty" })
	}
}

export async function claimBounty(
	req: Request,
	res: Response,
): Promise<void> {
	try {
		const walletAddress = normalizeAddress(
			(req as any).user?.address ?? (req as any).walletAddress,
		)
		if (!walletAddress) {
			res.status(401).json({ error: "Authentication required" })
			return
		}

		const id = Number.parseInt(req.params.id ?? "", 10)
		if (!Number.isFinite(id) || id <= 0) {
			res.status(400).json({ error: "Invalid bounty ID" })
			return
		}

		const bounty = await bountyStore.getBountyById(id)
		if (!bounty) {
			res.status(404).json({ error: "Bounty not found" })
			return
		}

		if (!isValidTransition(bounty.status, "claimed")) {
			res.status(400).json({ error: "Bounty is not in a claimable state" })
			return
		}

		if (bounty.sponsor_addr.toLowerCase() === walletAddress) {
			res.status(400).json({ error: "Sponsors cannot claim their own bounties" })
			return
		}

		if (bounty.deadline && new Date(bounty.deadline) < new Date()) {
			res.status(400).json({ error: "Bounty deadline has passed" })
			return
		}

		const hours = 72
		const claimDeadline = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()

		const claimed = await bountyStore.claimBounty(id, walletAddress, claimDeadline)
		if (!claimed) {
			res.status(409).json({ error: "Failed to claim bounty — it may have been claimed by another learner" })
			return
		}

		res.status(200).json({ bounty: claimed })
	} catch (err) {
		log.error({ err }, "Failed to claim bounty")
		res.status(500).json({ error: "Failed to claim bounty" })
	}
}

export async function submitWork(
	req: Request,
	res: Response,
): Promise<void> {
	try {
		const walletAddress = normalizeAddress(
			(req as any).user?.address ?? (req as any).walletAddress,
		)
		if (!walletAddress) {
			res.status(401).json({ error: "Authentication required" })
			return
		}

		const id = Number.parseInt(req.params.id ?? "", 10)
		if (!Number.isFinite(id) || id <= 0) {
			res.status(400).json({ error: "Invalid bounty ID" })
			return
		}

		const { repoUrl, notes } = req.body as {
			repoUrl?: string
			notes?: string
		}

		if (!repoUrl && !notes) {
			res.status(400).json({ error: "At least one of repoUrl or notes is required" })
			return
		}

		const bounty = await bountyStore.getBountyById(id)
		if (!bounty) {
			res.status(404).json({ error: "Bounty not found" })
			return
		}

		if (!isValidTransition(bounty.status, "submitted")) {
			res.status(400).json({ error: "Bounty is not in a submittable state" })
			return
		}

		if (
			bounty.claimed_by &&
			bounty.claimed_by.toLowerCase() !== walletAddress
		) {
			res.status(403).json({ error: "Only the claimant can submit work" })
			return
		}

		if (bounty.deadline && new Date(bounty.deadline) < new Date()) {
			res.status(400).json({ error: "Claim deadline has passed" })
			return
		}

		const { bounty: updated, submission } = await bountyStore.submitWork(
			id,
			walletAddress,
			repoUrl?.trim() ?? null,
			notes?.trim() ?? null,
		)

		if (!updated || !submission) {
			res.status(409).json({ error: "Failed to submit work" })
			return
		}

		res.status(200).json({ bounty: updated, submission })
	} catch (err) {
		log.error({ err }, "Failed to submit work")
		res.status(500).json({ error: "Failed to submit work" })
	}
}

export async function approveSubmission(
	req: Request,
	res: Response,
): Promise<void> {
	try {
		const walletAddress = normalizeAddress(
			(req as any).user?.address ?? (req as any).walletAddress,
		)
		if (!walletAddress) {
			res.status(401).json({ error: "Authentication required" })
			return
		}

		const id = Number.parseInt(req.params.id ?? "", 10)
		if (!Number.isFinite(id) || id <= 0) {
			res.status(400).json({ error: "Invalid bounty ID" })
			return
		}

		const bounty = await bountyStore.getBountyById(id)
		if (!bounty) {
			res.status(404).json({ error: "Bounty not found" })
			return
		}

		if (!isValidTransition(bounty.status, "approved")) {
			res.status(400).json({ error: "Bounty is not in an approvable state" })
			return
		}

		if (bounty.sponsor_addr.toLowerCase() !== walletAddress) {
			res.status(403).json({ error: "Only the sponsor can approve submissions" })
			return
		}

		const submission = await bountyStore.getSubmissionByBounty(id)
		if (!submission) {
			res.status(400).json({ error: "No submission found for this bounty" })
			return
		}

		// Release escrow USDC to learner
		const payout = await releaseEscrow(id, submission.learner_addr)

		// Mint LRN reward
		const lrnMint = await mintLrnReward(id, submission.learner_addr)

		// Update bounty status
		const updated = await bountyStore.approveSubmission(
			id,
			payout.txHash ?? null,
			lrnMint.txHash ?? null,
		)

		if (!updated) {
			res.status(409).json({ error: "Failed to approve — bounty may have already been processed" })
			return
		}

		res.status(200).json({
			bounty: updated,
			payout: {
				usdc: payout,
				lrn: lrnMint,
			},
		})
	} catch (err) {
		log.error({ err }, "Failed to approve submission")
		res.status(500).json({ error: "Failed to approve submission" })
	}
}

export async function cancelBounty(
	req: Request,
	res: Response,
): Promise<void> {
	try {
		const walletAddress = normalizeAddress(
			(req as any).user?.address ?? (req as any).walletAddress,
		)
		if (!walletAddress) {
			res.status(401).json({ error: "Authentication required" })
			return
		}

		const id = Number.parseInt(req.params.id ?? "", 10)
		if (!Number.isFinite(id) || id <= 0) {
			res.status(400).json({ error: "Invalid bounty ID" })
			return
		}

		const bounty = await bountyStore.getBountyById(id)
		if (!bounty) {
			res.status(404).json({ error: "Bounty not found" })
			return
		}

		if (bounty.sponsor_addr.toLowerCase() !== walletAddress) {
			res.status(403).json({ error: "Only the sponsor can cancel a bounty" })
			return
		}

		if (!isValidTransition(bounty.status, "cancelled")) {
			res.status(400).json({ error: "Bounty cannot be cancelled in its current state" })
			return
		}

		const cancelled = await bountyStore.cancelBounty(id, walletAddress)
		if (!cancelled) {
			res.status(409).json({ error: "Failed to cancel bounty" })
			return
		}

		res.status(200).json({ bounty: cancelled })
	} catch (err) {
		log.error({ err }, "Failed to cancel bounty")
		res.status(500).json({ error: "Failed to cancel bounty" })
	}
}
