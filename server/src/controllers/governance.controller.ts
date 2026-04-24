import { type Request, type Response } from "express"
import { z } from "zod"

import { pool } from "../db/index"
import { trackEscrowTimeout } from "../services/escrow-timeout.service"
import { stellarContractService } from "../services/stellar-contract.service"

type ProposalStatus = "pending" | "approved" | "rejected"
type ProposalPublicState = "open" | "closed" | "cancelled" | "executed"

const stellarAddressSchema = z.string().min(56).max(56).startsWith("G")

function parseStatus(value: unknown): ProposalStatus | undefined {
	if (typeof value !== "string") return undefined
	const normalized = value.trim().toLowerCase()
	if (
		normalized === "pending" ||
		normalized === "approved" ||
		normalized === "rejected"
	) {
		return normalized
	}
	return undefined
}

function parsePositiveInt(value: unknown, fallback: number): number {
	if (typeof value !== "string") return fallback
	const parsed = Number.parseInt(value, 10)
	if (Number.isNaN(parsed) || parsed < 1) return fallback
	return parsed
}

function parseProposalId(value: unknown): number | null {
	if (typeof value !== "string") return null
	const parsed = Number.parseInt(value, 10)
	if (Number.isNaN(parsed) || parsed < 1) return null
	return parsed
}

function deriveProposalState(proposal: {
	status: string
	cancelled?: boolean | null
	deadline?: Date | string | null
}): ProposalPublicState {
	if (proposal.cancelled) return "cancelled"
	if (proposal.status === "approved") return "executed"
	if (proposal.status === "rejected") return "closed"

	if (proposal.deadline) {
		const deadline = new Date(proposal.deadline)
		if (!Number.isNaN(deadline.getTime()) && deadline.getTime() <= Date.now()) {
			return "closed"
		}
	}

	return "open"
}

function parseViewerAddress(value: unknown): string | null {
	if (typeof value !== "string") return null
	const trimmed = value.trim()
	const validation = stellarAddressSchema.safeParse(trimmed)
	return validation.success ? validation.data : null
}

function buildProposalSelect(viewerParamIndex?: number) {
	const viewerVoteSelect = viewerParamIndex
		? ", uv.support AS user_vote_support"
		: ", NULL::boolean AS user_vote_support"
	const viewerJoin = viewerParamIndex
		? ` LEFT JOIN votes uv
			ON uv.proposal_id = p.id
			AND uv.voter_address = $${viewerParamIndex}`
		: ""

	return `SELECT
			p.id,
			p.author_address,
			p.title,
			p.description,
			p.amount,
			p.votes_for,
			p.votes_against,
			p.status,
			p.deadline,
			p.created_at${viewerVoteSelect}
		FROM proposals p${viewerJoin}`
}

export async function getGovernanceProposals(
	req: Request,
	res: Response,
): Promise<void> {
	const status = parseStatus(req.query.status)
	const viewerAddress = parseViewerAddress(req.query.viewer_address)
	const page = parsePositiveInt(req.query.page, 1)
	const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100)
	const offset = (page - 1) * limit

	const conditions: string[] = []
	const values: unknown[] = []

	if (status) {
		conditions.push(`p.status = $${values.length + 1}`)
		values.push(status)
	}

	const whereClause = conditions.length
		? `WHERE ${conditions.join(" AND ")}`
		: ""

	try {
		const totalResult = await pool.query(
			`SELECT COUNT(*)::int AS total FROM proposals p ${whereClause}`,
			values,
		)

		const total = Number(totalResult.rows[0]?.total ?? 0)

		const proposalValues = viewerAddress
			? [...values, limit, offset, viewerAddress]
			: [...values, limit, offset]
		const proposalsResult = await pool.query(
			`${buildProposalSelect(viewerAddress ? values.length + 3 : undefined)}
			 ${whereClause}
			 ORDER BY p.created_at DESC
			 LIMIT $${values.length + 1}
			 OFFSET $${values.length + 2}`,
			proposalValues,
		)

		res.status(200).json({
			proposals: proposalsResult.rows,
			total,
			page,
			totalPages: Math.ceil(total / limit),
		})
	} catch {
		res.status(500).json({ error: "Failed to fetch governance proposals" })
	}
}

export async function getGovernanceProposalById(
	req: Request,
	res: Response,
): Promise<void> {
	const proposalId = Number.parseInt(req.params.id, 10)
	const viewerAddress = parseViewerAddress(req.query.viewer_address)
	const values: unknown[] = viewerAddress
		? [proposalId, viewerAddress]
		: [proposalId]

	if (Number.isNaN(proposalId) || proposalId < 1) {
		res.status(400).json({ error: "Invalid proposal id" })
		return
	}

	try {
		const result = await pool.query(
			`${buildProposalSelect(viewerAddress ? 2 : undefined)}
			 WHERE p.id = $1
			 LIMIT 1`,
			values,
		)

		if (result.rows.length === 0) {
			res.status(404).json({ error: "Proposal not found" })
			return
		}

		res.status(200).json(result.rows[0])
	} catch {
		res.status(500).json({ error: "Failed to fetch governance proposal" })
	}
}

const GOV_DECIMALS = 7
const GOV_DIVISOR = 10n ** BigInt(GOV_DECIMALS)

export async function getVotingPower(
	req: Request,
	res: Response,
): Promise<void> {
	const { address } = req.params
	if (!address || address.length < 50) {
		res.status(400).json({ error: "Invalid Stellar address" })
		return
	}

	try {
		const rawBalance =
			await stellarContractService.getGovernanceVotingPower(address)
		const balanceBigInt = BigInt(rawBalance)
		const whole = balanceBigInt / GOV_DIVISOR
		const frac = balanceBigInt % GOV_DIVISOR
		const formatted = `${whole}.${frac.toString().padStart(GOV_DECIMALS, "0").slice(0, 2)}`

		res.status(200).json({
			address,
			gov_balance: rawBalance,
			formatted,
			can_vote: balanceBigInt > 0n,
		})
	} catch (err) {
		console.error("[governance] getVotingPower error:", err)
		res.status(500).json({ error: "Failed to fetch voting power" })
	}
}

const createProposalSchema = z.object({
	author_address: z.string().min(50).max(56),
	title: z.string().min(5).max(200),
	description: z.string().min(10),
	requested_amount: z.string().regex(/^\d+(\.\d+)?$/, "Must be a valid number"),
	evidence_url: z.string().url().optional(),
})

const castVoteSchema = z.object({
	proposal_id: z
		.number()
		.int()
		.positive("proposal_id must be a positive integer"),
	voter_address: z
		.string()
		.min(56, "voter_address must be a valid Stellar address")
		.max(56, "voter_address must be a valid Stellar address")
		.startsWith("G", "voter_address must be a valid Stellar address"),
	support: z.boolean(),
	signature: z.string().optional(),
})

export async function createGovernanceProposal(
	req: Request,
	res: Response,
): Promise<void> {
	const validation = createProposalSchema.safeParse(req.body)
	if (!validation.success) {
		res.status(400).json({
			error: "Invalid proposal data",
			details: validation.error.flatten().fieldErrors,
		})
		return
	}

	const { author_address, title, description, requested_amount, evidence_url } =
		validation.data
	const programUrl = evidence_url ?? "https://learnvault.app/dao/proposals"

	try {
		// Parse the requested amount
		const amount = Number.parseFloat(requested_amount)

		// Prepare contract parameters for ScholarshipTreasury.submit_proposal()
		const today = new Date()
		const startDate = new Date(today)
		startDate.setDate(startDate.getDate() + 7) // Start 1 week from now

		const milestone1 = new Date(startDate)
		milestone1.setMonth(milestone1.getMonth() + 1)

		const milestone2 = new Date(startDate)
		milestone2.setMonth(milestone2.getMonth() + 2)

		const milestone3 = new Date(startDate)
		milestone3.setMonth(milestone3.getMonth() + 3)

		// Convert to atomic units (USDC has 7 decimals on Stellar)
		const atomicAmount = Math.floor(amount * 10 ** 7)

		const params = {
			applicant: author_address,
			amount: atomicAmount,
			programName: title,
			programUrl,
			programDescription: description,
			startDate: startDate.toISOString().split("T")[0],
			milestoneTitles: [
				"Phase 1: Initial Progress",
				"Phase 2: Mid-term Completion",
				"Phase 3: Final Delivery",
			],
			milestoneDates: [
				milestone1.toISOString().split("T")[0],
				milestone2.toISOString().split("T")[0],
				milestone3.toISOString().split("T")[0],
			],
		}

		// 1. Call the on-chain contract first
		const contractResult =
			await stellarContractService.submitScholarshipProposal(params, {
				requestId: req.requestId,
			})

		// 2. Only write to DB if contract call succeeded
		const dbResult = await pool.query(
			`INSERT INTO proposals (
				author_address,
				title,
				description,
				amount,
				status,
				deadline,
				created_at
			) VALUES ($1, $2, $3, $4, 'pending', NOW() + INTERVAL '7 days', NOW())
			RETURNING id`,
			[author_address, title, description, amount],
		)

		const proposal_id = dbResult.rows[0]?.id
		if (proposal_id) {
			try {
				await trackEscrowTimeout({
					proposalId: proposal_id,
					scholarAddress: author_address,
				})
			} catch (trackingErr) {
				console.error("[governance] escrow tracking failed:", trackingErr)
			}
		}

		res.status(201).json({
			proposal_id,
			tx_hash: contractResult.txHash,
		})
	} catch (err) {
		console.error("[governance] Proposal creation failed:", err)
		res.status(500).json({
			error: "Failed to create governance proposal",
			message: err instanceof Error ? err.message : String(err),
		})
	}
}

export async function castVote(req: Request, res: Response): Promise<void> {
	const validation = castVoteSchema.safeParse(req.body)
	if (!validation.success) {
		res.status(400).json({
			error: "Invalid vote data",
			details: validation.error.flatten().fieldErrors,
		})
		return
	}

	const { proposal_id, voter_address, support } = validation.data

	try {
		// 1. Check if proposal exists
		const proposalResult = await pool.query(
			"SELECT id, status, deadline, cancelled FROM proposals WHERE id = $1",
			[proposal_id],
		)

		if (proposalResult.rows.length === 0) {
			res.status(404).json({ error: "Proposal not found" })
			return
		}

		if (proposalResult.rows[0].cancelled) {
			res.status(400).json({
				error: "Voting is closed for this proposal",
			})
			return
		}

		// 2. Check if proposal is still pending
		if (proposalResult.rows[0].status !== "pending") {
			res.status(400).json({
				error: "Voting is closed for this proposal",
			})
			return
		}

		if (
			proposalResult.rows[0].deadline &&
			new Date(proposalResult.rows[0].deadline).getTime() <= Date.now()
		) {
			res.status(400).json({
				error: "Voting is closed for this proposal",
			})
			return
		}

		// 3. Check if voter already voted
		const existingVote = await pool.query(
			"SELECT id FROM votes WHERE proposal_id = $1 AND voter_address = $2",
			[proposal_id, voter_address],
		)

		if (existingVote.rows.length > 0) {
			res.status(409).json({ error: "You have already voted on this proposal" })
			return
		}

		// 4. Check voter's effective voting power (own balance + any delegated-to-them)
		const rawBalance =
			await stellarContractService.getGovernanceVotingPower(voter_address)
		const balanceBigInt = BigInt(rawBalance)

		if (balanceBigInt <= 0n) {
			res.status(400).json({
				error: "You have no voting power",
				details: "Voter has no GOV tokens",
			})
			return
		}

		// 5. Call the on-chain vote contract
		const contractResult = await stellarContractService.castVote(
			{
				voter: voter_address,
				proposalId: proposal_id,
				support,
			},
			{ requestId: req.requestId },
		)

		// 6. Write to DB after successful contract call
		const votingPower = balanceBigInt
		const dbResult = await pool.query(
			`INSERT INTO votes (proposal_id, voter_address, support, voting_power, tx_hash)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id`,
			[
				proposal_id,
				voter_address,
				support,
				votingPower.toString(),
				contractResult.txHash,
			],
		)

		// 7. Update proposal vote counts
		const updateColumn = support ? "votes_for" : "votes_against"
		await pool.query(
			`UPDATE proposals SET ${updateColumn} = ${updateColumn} + $1 WHERE id = $2`,
			[votingPower.toString(), proposal_id],
		)

		// 8. Fetch updated vote counts for response
		const updatedProposal = await pool.query(
			"SELECT votes_for, votes_against FROM proposals WHERE id = $1",
			[proposal_id],
		)

		res.status(201).json({
			tx_hash: contractResult.txHash,
			votes_for: updatedProposal.rows[0]?.votes_for ?? "0",
			votes_against: updatedProposal.rows[0]?.votes_against ?? "0",
		})
	} catch (err) {
		console.error("[governance] Vote casting failed:", err)
		res.status(500).json({
			error: "Failed to cast vote",
			message: err instanceof Error ? err.message : String(err),
		})
	}
}

export async function getProposalStatus(
	req: Request,
	res: Response,
): Promise<void> {
	const proposalId = parseProposalId(req.params.id)
	if (!proposalId) {
		res.status(400).json({ error: "Invalid proposal id" })
		return
	}

	try {
		const result = await pool.query(
			"SELECT id, status, deadline, cancelled FROM proposals WHERE id = $1",
			[proposalId],
		)

		if (result.rows.length === 0) {
			res.status(404).json({ error: "Proposal not found" })
			return
		}

		const proposal = result.rows[0]
		res.status(200).json({
			id: proposal.id,
			state: deriveProposalState(proposal),
			status: proposal.status,
			cancelled: Boolean(proposal.cancelled),
			deadline: proposal.deadline ?? null,
		})
	} catch (err) {
		console.error("[governance] Get proposal status failed:", err)
		res.status(500).json({ error: "Failed to fetch proposal status" })
	}
}

export async function cancelProposal(
	req: Request,
	res: Response,
): Promise<void> {
	const proposalId = parseProposalId(req.params.id)
	if (!proposalId) {
		res.status(400).json({ error: "Invalid proposal id" })
		return
	}

	try {
		const proposalResult = await pool.query(
			"SELECT id, status, deadline, cancelled FROM proposals WHERE id = $1",
			[proposalId],
		)

		if (proposalResult.rows.length === 0) {
			res.status(404).json({ error: "Proposal not found" })
			return
		}

		const proposal = proposalResult.rows[0]

		if (proposal.cancelled) {
			res.status(409).json({ error: "Proposal is already cancelled" })
			return
		}

		if (deriveProposalState(proposal) !== "open") {
			res.status(409).json({ error: "Only open proposals can be cancelled" })
			return
		}

		await stellarContractService.cancelProposal(
			{ proposalId },
			{ requestId: req.requestId },
		)
		await pool.query("UPDATE proposals SET cancelled = TRUE WHERE id = $1", [
			proposalId,
		])

		res.status(204).end()
	} catch (err) {
		console.error("[governance] Cancel proposal failed:", err)
		res.status(500).json({
			error: "Failed to cancel proposal",
			message: err instanceof Error ? err.message : String(err),
		})
	}
}

export async function getDelegation(
	req: Request,
	res: Response,
): Promise<void> {
	const { address } = req.params
	if (!address || address.length < 50) {
		res.status(400).json({ error: "Invalid Stellar address" })
		return
	}

	try {
		const [rawVotingPower, rawOwnBalance, delegatee] = await Promise.all([
			stellarContractService.getGovernanceVotingPower(address),
			stellarContractService.getGovernanceTokenBalance(address),
			stellarContractService.getGovernanceDelegation(address),
		])

		const ownBalance = BigInt(rawOwnBalance)
		const votingPower = BigInt(rawVotingPower)
		const delegatedToMe = delegatee ? 0n : votingPower - ownBalance

		res.status(200).json({
			address,
			delegatee,
			is_delegating: delegatee !== null,
			own_balance: rawOwnBalance,
			delegated_to_me: delegatedToMe > 0n ? delegatedToMe.toString() : "0",
			voting_power: rawVotingPower,
		})
	} catch (err) {
		console.error("[governance] getDelegation error:", err)
		res.status(500).json({ error: "Failed to fetch delegation state" })
	}
}
