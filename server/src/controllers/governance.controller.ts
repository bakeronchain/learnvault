import { type Request, type Response } from "express"
import { z } from "zod"

import { pool } from "../db/index"
import { stellarContractService } from "../services/stellar-contract.service"

type ProposalStatus = "pending" | "approved" | "rejected"

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

export async function getGovernanceProposals(
	req: Request,
	res: Response,
): Promise<void> {
	const status = parseStatus(req.query.status)
	const page = parsePositiveInt(req.query.page, 1)
	const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100)
	const offset = (page - 1) * limit

	const conditions: string[] = []
	const values: unknown[] = []

	if (status) {
		conditions.push(`status = $${values.length + 1}`)
		values.push(status)
	}

	const whereClause = conditions.length
		? `WHERE ${conditions.join(" AND ")}`
		: ""

	try {
		const totalResult = await pool.query(
			`SELECT COUNT(*)::int AS total FROM proposals ${whereClause}`,
			values,
		)

		const total = Number(totalResult.rows[0]?.total ?? 0)

		const proposalValues = [...values, limit, offset]
		const proposalsResult = await pool.query(
			`SELECT id, author_address, title, description, amount, votes_for, votes_against, status, deadline
			 FROM proposals
			 ${whereClause}
			 ORDER BY created_at DESC
			 LIMIT $${values.length + 1}
			 OFFSET $${values.length + 2}`,
			proposalValues,
		)

		res.status(200).json({
			proposals: proposalsResult.rows,
			total,
			page,
		})
	} catch {
		res.status(500).json({ error: "Failed to fetch governance proposals" })
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
			await stellarContractService.getGovernanceTokenBalance(address)
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
	evidence_url: z.string().url(),
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
			programUrl: evidence_url,
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
			await stellarContractService.submitScholarshipProposal(params)

		// 2. Only write to DB if contract call succeeded
		const dbResult = await pool.query(
			`INSERT INTO proposals (
				author_address,
				title,
				description,
				amount,
				status,
				created_at
			) VALUES ($1, $2, $3, $4, 'pending', NOW())
			RETURNING id`,
			[author_address, title, description, amount],
		)

		const proposal_id = dbResult.rows[0]?.id

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
