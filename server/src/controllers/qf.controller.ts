import { type Request, type Response } from "express"
import { z } from "zod"

import { pool } from "../db/index"
import { logger, maskAddress } from "../lib/logger"
import {
	buildDisbursementPlan,
	computeStandings,
	type QfContribution,
} from "../lib/qf"
import { type AuthRequest } from "../middleware/auth.middleware"
import { verifyContributionTx } from "../services/qf-tx-verify.service"

const log = logger.child({ module: "qf" })

// Minimum sybil trust score required to contribute. The score is additive over
// verified identity methods (see anti-sybil.controller). Gating contributions
// resists a single actor spinning up many wallets to inflate the unique-donor
// count that drives the quadratic match.
const MIN_SYBIL_SCORE = Number(process.env.QF_MIN_SYBIL_SCORE ?? "20")

const createRoundSchema = z.object({
	name: z.string().min(2).max(200),
	matching_pool: z.number().positive(),
	start_ts: z.string().datetime(),
	end_ts: z.string().datetime(),
})

const contributeSchema = z.object({
	proposal_id: z.number().int().positive(),
	amount_usdc: z.number().positive(),
	tx_hash: z.string().min(1).max(128),
})

interface QfRoundRow {
	id: number
	name: string
	matching_pool: string
	start_ts: Date | string
	end_ts: Date | string
	status: "upcoming" | "active" | "finalized"
	created_at: Date | string
}

function serializeRound(row: QfRoundRow) {
	return {
		id: row.id,
		name: row.name,
		matching_pool: Number(row.matching_pool),
		start_ts: new Date(row.start_ts).toISOString(),
		end_ts: new Date(row.end_ts).toISOString(),
		status: row.status,
		created_at: new Date(row.created_at).toISOString(),
	}
}

/**
 * Derives the effective status of a round from its window. Rounds are stored
 * with a coarse status but the live status also depends on the current time:
 * an 'upcoming' round whose start has passed is effectively 'active', and an
 * 'active' round past its end is 'closed' (awaiting finalize). 'finalized' is
 * terminal and never recomputed.
 */
function effectiveStatus(
	row: QfRoundRow,
	now: Date,
): "upcoming" | "active" | "closed" | "finalized" {
	if (row.status === "finalized") return "finalized"
	const start = new Date(row.start_ts)
	const end = new Date(row.end_ts)
	if (now < start) return "upcoming"
	if (now > end) return "closed"
	return "active"
}

async function loadRound(roundId: number): Promise<QfRoundRow | null> {
	const result = await pool.query(`SELECT * FROM qf_rounds WHERE id = $1`, [
		roundId,
	])
	return (result.rows[0] as QfRoundRow | undefined) ?? null
}

async function loadContributions(roundId: number): Promise<QfContribution[]> {
	const result = await pool.query(
		`SELECT proposal_id, donor_addr, amount_usdc
		 FROM qf_contributions
		 WHERE round_id = $1`,
		[roundId],
	)
	return result.rows.map(
		(r: { proposal_id: number; donor_addr: string; amount_usdc: string }) => ({
			proposalId: Number(r.proposal_id),
			donorAddr: r.donor_addr,
			amount: Number(r.amount_usdc),
		}),
	)
}

// ---------------------------------------------------------------------------
// POST /api/qf/rounds  (admin) — create a round with a matching pool
// ---------------------------------------------------------------------------

export async function createRound(req: Request, res: Response): Promise<void> {
	const parsed = createRoundSchema.safeParse(req.body)
	if (!parsed.success) {
		res.status(400).json({
			error: "Invalid round data",
			details: parsed.error.flatten().fieldErrors,
		})
		return
	}

	const { name, matching_pool, start_ts, end_ts } = parsed.data
	if (new Date(end_ts) <= new Date(start_ts)) {
		res.status(400).json({ error: "end_ts must be after start_ts" })
		return
	}

	try {
		const result = await pool.query(
			`INSERT INTO qf_rounds (name, matching_pool, start_ts, end_ts, status)
			 VALUES ($1, $2, $3, $4, 'upcoming')
			 RETURNING *`,
			[name, matching_pool, start_ts, end_ts],
		)
		res.status(201).json(serializeRound(result.rows[0] as QfRoundRow))
	} catch (err) {
		log.error({ err }, "Failed to create QF round")
		res.status(500).json({ error: "Failed to create QF round" })
	}
}

// ---------------------------------------------------------------------------
// GET /api/qf/rounds — list rounds
// ---------------------------------------------------------------------------

export async function listRounds(_req: Request, res: Response): Promise<void> {
	try {
		const result = await pool.query(
			`SELECT * FROM qf_rounds ORDER BY start_ts DESC`,
		)
		const now = new Date()
		res.json({
			rounds: result.rows.map((row: QfRoundRow) => ({
				...serializeRound(row),
				effective_status: effectiveStatus(row, now),
			})),
		})
	} catch (err) {
		log.error({ err }, "Failed to list QF rounds")
		res.status(500).json({ error: "Failed to list QF rounds" })
	}
}

// ---------------------------------------------------------------------------
// GET /api/qf/rounds/:id/standings — live match estimator
// ---------------------------------------------------------------------------

export async function getStandings(req: Request, res: Response): Promise<void> {
	const roundId = Number(req.params.id)
	if (!Number.isInteger(roundId) || roundId <= 0) {
		res.status(400).json({ error: "Invalid round id" })
		return
	}

	try {
		const round = await loadRound(roundId)
		if (!round) {
			res.status(404).json({ error: "Round not found" })
			return
		}

		const contributions = await loadContributions(roundId)
		const matchingPool = Number(round.matching_pool)
		const standings = computeStandings(contributions, matchingPool)

		res.json({
			round_id: roundId,
			matching_pool: matchingPool,
			status: effectiveStatus(round, new Date()),
			standings: standings.map((s) => ({
				proposal_id: s.proposalId,
				total_contributions: s.totalContributions,
				unique_contributors: s.uniqueContributors,
				match_weight: s.matchWeight,
				estimated_match: s.estimatedMatch,
			})),
		})
	} catch (err) {
		log.error({ err, roundId }, "Failed to compute standings")
		res.status(500).json({ error: "Failed to compute standings" })
	}
}

// ---------------------------------------------------------------------------
// POST /api/qf/rounds/:id/contribute — record a tx-verified contribution
// ---------------------------------------------------------------------------

export async function contribute(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const donorAddr = req.user?.address
	if (!donorAddr) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const roundId = Number(req.params.id)
	if (!Number.isInteger(roundId) || roundId <= 0) {
		res.status(400).json({ error: "Invalid round id" })
		return
	}

	const parsed = contributeSchema.safeParse(req.body)
	if (!parsed.success) {
		res.status(400).json({
			error: "Invalid contribution data",
			details: parsed.error.flatten().fieldErrors,
		})
		return
	}
	const { proposal_id, amount_usdc, tx_hash } = parsed.data

	try {
		// 1. Anti-sybil gate — the contributor must clear the trust threshold.
		const passed = await passesSybilCheck(donorAddr)
		if (!passed) {
			res.status(403).json({
				error: "Identity verification required to contribute",
				min_sybil_score: MIN_SYBIL_SCORE,
			})
			return
		}

		// 2. Round must exist and be within its contribution window.
		const round = await loadRound(roundId)
		if (!round) {
			res.status(404).json({ error: "Round not found" })
			return
		}
		if (round.status === "finalized") {
			res.status(409).json({ error: "Round is finalized" })
			return
		}
		const now = new Date()
		const status = effectiveStatus(round, now)
		if (status !== "active") {
			res.status(409).json({
				error:
					status === "upcoming"
						? "Round has not started yet"
						: "Round contribution window has closed",
			})
			return
		}

		// 3. Verify the transaction on Horizon before recording it.
		const verification = await verifyContributionTx({
			txHash: tx_hash,
			expectedSource: donorAddr,
			expectedAmount: amount_usdc,
		})
		if (!verification.valid) {
			res.status(400).json({
				error: "Transaction verification failed",
				reason: verification.reason,
			})
			return
		}

		// 4. Record the contribution. tx_hash UNIQUE guards against replay.
		const inserted = await pool.query(
			`INSERT INTO qf_contributions
			   (round_id, proposal_id, donor_addr, amount_usdc, tx_hash)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (tx_hash) DO NOTHING
			 RETURNING id`,
			[roundId, proposal_id, donorAddr, amount_usdc, tx_hash],
		)
		if (inserted.rowCount === 0) {
			res.status(409).json({ error: "Transaction already recorded" })
			return
		}

		res.status(201).json({
			id: inserted.rows[0].id,
			round_id: roundId,
			proposal_id,
			donor_addr: donorAddr,
			amount_usdc,
			tx_hash,
		})
	} catch (err) {
		log.error(
			{ err, roundId, donorAddr: maskAddress(donorAddr) },
			"Failed to record contribution",
		)
		res.status(500).json({ error: "Failed to record contribution" })
	}
}

// ---------------------------------------------------------------------------
// POST /api/qf/rounds/:id/finalize  (admin) — lock standings, produce plan
// ---------------------------------------------------------------------------

export async function finalizeRound(
	req: Request,
	res: Response,
): Promise<void> {
	const roundId = Number(req.params.id)
	if (!Number.isInteger(roundId) || roundId <= 0) {
		res.status(400).json({ error: "Invalid round id" })
		return
	}

	try {
		const round = await loadRound(roundId)
		if (!round) {
			res.status(404).json({ error: "Round not found" })
			return
		}
		if (round.status === "finalized") {
			res.status(409).json({ error: "Round is already finalized" })
			return
		}

		const contributions = await loadContributions(roundId)
		const matchingPool = Number(round.matching_pool)
		const plan = buildDisbursementPlan(contributions, matchingPool)

		await pool.query(
			`UPDATE qf_rounds SET status = 'finalized' WHERE id = $1`,
			[roundId],
		)

		res.json({
			round_id: roundId,
			matching_pool: plan.matchingPool,
			total_matched: plan.totalMatched,
			disbursements: plan.entries.map((e) => ({
				proposal_id: e.proposalId,
				total_contributions: e.totalContributions,
				unique_contributors: e.uniqueContributors,
				match_weight: e.matchWeight,
				match_amount: e.matchAmount,
			})),
		})
	} catch (err) {
		log.error({ err, roundId }, "Failed to finalize round")
		res.status(500).json({ error: "Failed to finalize round" })
	}
}

/**
 * Reuses the anti-sybil trust score (verified identity methods) to gate
 * contributions. Mirrors the additive scoring in anti-sybil.controller.
 */
const METHOD_WEIGHTS: Record<string, number> = {
	email: 20,
	phone: 20,
	government_id: 35,
	biometric: 25,
}

async function passesSybilCheck(walletAddress: string): Promise<boolean> {
	const result = await pool.query(
		`SELECT method
		 FROM identity_verifications
		 WHERE wallet_address = $1 AND status = 'verified'`,
		[walletAddress],
	)
	let score = 0
	for (const row of result.rows as { method: string }[]) {
		score += METHOD_WEIGHTS[row.method] ?? 0
	}
	return score >= MIN_SYBIL_SCORE
}
