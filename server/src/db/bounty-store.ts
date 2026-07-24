import { pool } from "./index"

export type BountyStatus =
	| "open"
	| "claimed"
	| "submitted"
	| "approved"
	| "paid"
	| "cancelled"

export interface Bounty {
	id: number
	sponsor_addr: string
	title: string
	description: string
	skill_tags: string[]
	reward_usdc: string
	escrow_tx: string | null
	status: BountyStatus
	claimed_by: string | null
	deadline: string | null
	payout_tx: string | null
	reward_tx: string | null
	approved_at: string | null
	paid_at: string | null
	created_at: string
}

export interface BountySubmission {
	id: number
	bounty_id: number
	learner_addr: string
	repo_url: string | null
	notes: string | null
	submitted_at: string
}

export interface BountyFilters {
	skill?: string
	status?: BountyStatus
	page?: number
	pageSize?: number
	sponsorAddr?: string
}

export interface PaginatedBounties {
	data: Bounty[]
	total: number
}

export const bountyStore = {
	async createBounty(data: {
		sponsor_addr: string
		title: string
		description: string
		skill_tags: string[]
		reward_usdc: string
		escrow_tx: string | null
		deadline: string | null
	}): Promise<Bounty> {
		const result = await pool.query(
			`INSERT INTO bounties (sponsor_addr, title, description, skill_tags, reward_usdc, escrow_tx, status, deadline)
			 VALUES ($1, $2, $3, $4, $5, $6, 'open', $7)
			 RETURNING *`,
			[
				data.sponsor_addr,
				data.title,
				data.description,
				data.skill_tags,
				data.reward_usdc,
				data.escrow_tx,
				data.deadline,
			],
		)
		return result.rows[0]
	},

	async listBounties(
		filters: BountyFilters = {},
	): Promise<PaginatedBounties> {
		const page = filters.page ?? 1
		const pageSize = Math.min(filters.pageSize ?? 20, 100)
		const values: Array<string | number> = []
		const conditions: string[] = []

		if (filters.skill) {
			values.push(filters.skill)
			conditions.push(`$${values.length} = ANY(skill_tags)`)
		}

		if (filters.status) {
			values.push(filters.status)
			conditions.push(`status = $${values.length}`)
		}

		if (filters.sponsorAddr) {
			values.push(filters.sponsorAddr)
			conditions.push(`LOWER(sponsor_addr) = LOWER($${values.length})`)
		}

		const whereClause =
			conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

		const totalResult = await pool.query(
			`SELECT COUNT(*) AS total FROM bounties ${whereClause}`,
			values,
		)
		const total = Number(totalResult.rows[0]?.total ?? 0)

		const offset = (page - 1) * pageSize
		const rowValues = [...values, pageSize, offset]
		const limitParam = values.length + 1
		const offsetParam = values.length + 2

		const dataResult = await pool.query(
			`SELECT * FROM bounties ${whereClause}
			 ORDER BY created_at DESC
			 LIMIT $${limitParam} OFFSET $${offsetParam}`,
			rowValues,
		)

		return { data: dataResult.rows, total }
	},

	async getBountyById(id: number): Promise<Bounty | null> {
		const result = await pool.query(
			`SELECT * FROM bounties WHERE id = $1`,
			[id],
		)
		return result.rows[0] ?? null
	},

	async claimBounty(
		id: number,
		claimedBy: string,
		deadline: string,
	): Promise<Bounty | null> {
		const client = await pool.connect()
		try {
			await client.query("BEGIN")
			const lockResult = await client.query(
				`SELECT * FROM bounties WHERE id = $1 FOR UPDATE`,
				[id],
			)
			const bounty = lockResult.rows[0]
			if (!bounty) {
				await client.query("ROLLBACK")
				return null
			}
			if (bounty.status !== "open") {
				await client.query("ROLLBACK")
				return null
			}
			if (bounty.deadline && new Date(bounty.deadline) < new Date()) {
				await client.query("ROLLBACK")
				return null
			}
			const updateResult = await client.query(
				`UPDATE bounties
				 SET status = 'claimed', claimed_by = $1, deadline = $2
				 WHERE id = $3 AND status = 'open'
				 RETURNING *`,
				[claimedBy, deadline, id],
			)
			await client.query("COMMIT")
			return updateResult.rows[0] ?? null
		} catch (err) {
			await client.query("ROLLBACK")
			throw err
		} finally {
			client.release()
		}
	},

	async submitWork(
		bountyId: number,
		learnerAddr: string,
		repoUrl: string | null,
		notes: string | null,
	): Promise<{ bounty: Bounty | null; submission: BountySubmission | null }> {
		const client = await pool.connect()
		try {
			await client.query("BEGIN")
			const lockResult = await client.query(
				`SELECT * FROM bounties WHERE id = $1 FOR UPDATE`,
				[bountyId],
			)
			const bounty = lockResult.rows[0]
			if (!bounty || bounty.status !== "claimed") {
				await client.query("ROLLBACK")
				return { bounty: null, submission: null }
			}
			if (
				bounty.claimed_by &&
				bounty.claimed_by.toLowerCase() !== learnerAddr.toLowerCase()
			) {
				await client.query("ROLLBACK")
				return { bounty: null, submission: null }
			}
			if (bounty.deadline && new Date(bounty.deadline) < new Date()) {
				await client.query("ROLLBACK")
				return { bounty: null, submission: null }
			}

			const submissionResult = await client.query(
				`INSERT INTO bounty_submissions (bounty_id, learner_addr, repo_url, notes)
				 VALUES ($1, $2, $3, $4)
				 RETURNING *`,
				[bountyId, learnerAddr, repoUrl, notes],
			)

			const updateResult = await client.query(
				`UPDATE bounties SET status = 'submitted' WHERE id = $1 RETURNING *`,
				[bountyId],
			)

			await client.query("COMMIT")
			return {
				bounty: updateResult.rows[0] ?? null,
				submission: submissionResult.rows[0] ?? null,
			}
		} catch (err) {
			await client.query("ROLLBACK")
			throw err
		} finally {
			client.release()
		}
	},

	async approveSubmission(
		bountyId: number,
		payoutTx: string | null,
		rewardTx: string | null,
	): Promise<Bounty | null> {
		const result = await pool.query(
			`UPDATE bounties
			 SET status = 'paid', payout_tx = $1, reward_tx = $2, approved_at = NOW(), paid_at = NOW()
			 WHERE id = $3 AND status = 'submitted'
			 RETURNING *`,
			[payoutTx, rewardTx, bountyId],
		)
		return result.rows[0] ?? null
	},

	async getSubmissionByBounty(
		bountyId: number,
	): Promise<BountySubmission | null> {
		const result = await pool.query(
			`SELECT * FROM bounty_submissions WHERE bounty_id = $1 ORDER BY submitted_at DESC LIMIT 1`,
			[bountyId],
		)
		return result.rows[0] ?? null
	},

	async getSubmissionByBountyAndLearner(
		bountyId: number,
		learnerAddr: string,
	): Promise<BountySubmission | null> {
		const result = await pool.query(
			`SELECT * FROM bounty_submissions WHERE bounty_id = $1 AND LOWER(learner_addr) = LOWER($2) LIMIT 1`,
			[bountyId, learnerAddr],
		)
		return result.rows[0] ?? null
	},

	async cancelBounty(id: number, sponsorAddr: string): Promise<Bounty | null> {
		const result = await pool.query(
			`UPDATE bounties
			 SET status = 'cancelled'
			 WHERE id = $1 AND LOWER(sponsor_addr) = LOWER($2) AND status IN ('open', 'claimed')
			 RETURNING *`,
			[id, sponsorAddr],
		)
		return result.rows[0] ?? null
	},

	async reopenExpiredClaims(): Promise<number> {
		const result = await pool.query(
			`UPDATE bounties
			 SET status = 'open', claimed_by = NULL, deadline = NULL
			 WHERE status = 'claimed'
			   AND deadline IS NOT NULL
			   AND deadline < NOW()
			   AND id NOT IN (
				 SELECT bounty_id FROM bounty_submissions
			   )`,
		)
		return result.rowCount ?? 0
	},

	async isEscrowTxFunded(escrowTx: string): Promise<boolean> {
		const result = await pool.query(
			`SELECT 1 FROM bounties WHERE escrow_tx = $1 AND status != 'cancelled' LIMIT 1`,
			[escrowTx],
		)
		return (result.rowCount ?? 0) > 0
	},
}
