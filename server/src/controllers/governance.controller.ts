import { type Request, type Response } from "express"

import { pool } from "../db/index"

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
