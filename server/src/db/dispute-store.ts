import { pool } from "./index"

export type DisputePhase = "active" | "resolved" | "quorum_failed"

export interface Dispute {
	dispute_id: string
	proposal_id: number
	milestone_id: number
	scholar_address: string
	evidence_ipfs_cid: string | null
	evidence_hash: string
	scholar_stake: string
	opened_at: string
	commit_deadline: string
	reveal_deadline: string
	phase: DisputePhase
	votes_for: number
	votes_against: number
	revealed_count: number
	outcome: boolean | null
	resolved_at: string | null
	resolve_tx_hash: string | null
	open_tx_hash: string | null
	created_at: string
	updated_at: string
}

export interface DisputeJuror {
	dispute_id: string
	juror_address: string
	has_committed: boolean
	has_revealed: boolean
}

export interface DisputeVote {
	dispute_id: string
	juror_address: string
	vote: boolean
	revealed_at: string
}

export interface DisputeFilters {
	phase?: DisputePhase
	page?: number
	pageSize?: number
}

export interface PaginatedDisputes {
	data: Dispute[]
	total: number
}

export const disputeStore = {
	async upsertDisputeOpened(data: {
		disputeId: string
		proposalId: number
		milestoneId: number
		scholarAddress: string
		evidenceHash: string
		scholarStake: string
		openedAt: Date
		commitDeadline: Date
		revealDeadline: Date
		panel: string[]
		openTxHash: string | null
	}): Promise<void> {
		await pool.query(
			`INSERT INTO disputes (
				dispute_id, proposal_id, milestone_id, scholar_address, evidence_hash,
				scholar_stake, opened_at, commit_deadline, reveal_deadline, open_tx_hash
			 )
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			 ON CONFLICT (dispute_id) DO NOTHING`,
			[
				data.disputeId,
				data.proposalId,
				data.milestoneId,
				data.scholarAddress,
				data.evidenceHash,
				data.scholarStake,
				data.openedAt,
				data.commitDeadline,
				data.revealDeadline,
				data.openTxHash,
			],
		)

		for (const jurorAddress of data.panel) {
			await pool.query(
				`INSERT INTO dispute_jurors (dispute_id, juror_address)
				 VALUES ($1, $2)
				 ON CONFLICT (dispute_id, juror_address) DO NOTHING`,
				[data.disputeId, jurorAddress],
			)
		}
	},

	async markCommitted(disputeId: string, jurorAddress: string): Promise<void> {
		await pool.query(
			`UPDATE dispute_jurors SET has_committed = TRUE
			 WHERE dispute_id = $1 AND juror_address = $2`,
			[disputeId, jurorAddress],
		)
	},

	async recordReveal(data: {
		disputeId: string
		jurorAddress: string
		vote: boolean
		revealedAt: Date
		txHash: string | null
	}): Promise<void> {
		await pool.query(
			`INSERT INTO dispute_votes (dispute_id, juror_address, vote, revealed_at, tx_hash)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (dispute_id, juror_address) DO NOTHING`,
			[
				data.disputeId,
				data.jurorAddress,
				data.vote,
				data.revealedAt,
				data.txHash,
			],
		)
		await pool.query(
			`UPDATE dispute_jurors SET has_revealed = TRUE
			 WHERE dispute_id = $1 AND juror_address = $2`,
			[data.disputeId, data.jurorAddress],
		)
		await pool.query(
			`UPDATE disputes SET
				votes_for = votes_for + CASE WHEN $2 THEN 1 ELSE 0 END,
				votes_against = votes_against + CASE WHEN $2 THEN 0 ELSE 1 END,
				revealed_count = revealed_count + 1,
				updated_at = NOW()
			 WHERE dispute_id = $1`,
			[data.disputeId, data.vote],
		)
	},

	async markResolved(data: {
		disputeId: string
		outcome: boolean | null
		votesFor: number
		votesAgainst: number
		revealedCount: number
		quorumMet: boolean
		resolvedAt: Date
		resolveTxHash: string | null
	}): Promise<void> {
		await pool.query(
			`UPDATE disputes SET
				phase = $2,
				outcome = $3,
				votes_for = $4,
				votes_against = $5,
				revealed_count = $6,
				resolved_at = $7,
				resolve_tx_hash = $8,
				updated_at = NOW()
			 WHERE dispute_id = $1`,
			[
				data.disputeId,
				data.quorumMet ? "resolved" : "quorum_failed",
				data.outcome,
				data.votesFor,
				data.votesAgainst,
				data.revealedCount,
				data.resolvedAt,
				data.resolveTxHash,
			],
		)
	},

	async setEvidenceCid(
		disputeId: string,
		evidenceIpfsCid: string,
	): Promise<void> {
		await pool.query(
			`UPDATE disputes SET evidence_ipfs_cid = $2, updated_at = NOW() WHERE dispute_id = $1`,
			[disputeId, evidenceIpfsCid],
		)
	},

	/** Register a CID before the scholar signs `open_dispute` on-chain. */
	async setPendingEvidence(data: {
		proposalId: number
		milestoneId: number
		scholarAddress: string
		evidenceIpfsCid: string
	}): Promise<void> {
		await pool.query(
			`INSERT INTO pending_dispute_evidence (proposal_id, milestone_id, scholar_address, evidence_ipfs_cid)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (proposal_id, milestone_id)
			 DO UPDATE SET evidence_ipfs_cid = EXCLUDED.evidence_ipfs_cid, scholar_address = EXCLUDED.scholar_address`,
			[
				data.proposalId,
				data.milestoneId,
				data.scholarAddress,
				data.evidenceIpfsCid,
			],
		)
	},

	/** Consumed once by the indexer when it observes DisputeOpened. */
	async takePendingEvidence(
		proposalId: number,
		milestoneId: number,
	): Promise<string | null> {
		const result = await pool.query<{ evidence_ipfs_cid: string }>(
			`DELETE FROM pending_dispute_evidence WHERE proposal_id = $1 AND milestone_id = $2
			 RETURNING evidence_ipfs_cid`,
			[proposalId, milestoneId],
		)
		return result.rows[0]?.evidence_ipfs_cid ?? null
	},

	async listDisputes(filters: DisputeFilters = {}): Promise<PaginatedDisputes> {
		const page = filters.page ?? 1
		const pageSize = Math.min(filters.pageSize ?? 20, 100)
		const values: Array<string | number> = []
		const conditions: string[] = []

		if (filters.phase) {
			values.push(filters.phase)
			conditions.push(`phase = $${values.length}`)
		}

		const where =
			conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

		const countResult = await pool.query<{ count: string }>(
			`SELECT COUNT(*) FROM disputes ${where}`,
			values,
		)
		const total = Number.parseInt(countResult.rows[0]?.count ?? "0", 10)

		const offset = (page - 1) * pageSize
		values.push(pageSize, offset)
		const result = await pool.query<Dispute>(
			`SELECT * FROM disputes ${where}
			 ORDER BY opened_at DESC
			 LIMIT $${values.length - 1} OFFSET $${values.length}`,
			values,
		)

		return { data: result.rows, total }
	},

	async getDisputeById(disputeId: string): Promise<Dispute | null> {
		const result = await pool.query<Dispute>(
			`SELECT * FROM disputes WHERE dispute_id = $1`,
			[disputeId],
		)
		return result.rows[0] ?? null
	},

	async getJurorsForDispute(disputeId: string): Promise<DisputeJuror[]> {
		const result = await pool.query<DisputeJuror>(
			`SELECT dispute_id, juror_address, has_committed, has_revealed
			 FROM dispute_jurors WHERE dispute_id = $1
			 ORDER BY id ASC`,
			[disputeId],
		)
		return result.rows
	},

	async getVotesForDispute(disputeId: string): Promise<DisputeVote[]> {
		const result = await pool.query<DisputeVote>(
			`SELECT dispute_id, juror_address, vote, revealed_at
			 FROM dispute_votes WHERE dispute_id = $1
			 ORDER BY revealed_at ASC`,
			[disputeId],
		)
		return result.rows
	},

	/** Every dispute where `jurorAddress` was drawn onto the panel. */
	async getAssignmentsForJuror(jurorAddress: string): Promise<Dispute[]> {
		const result = await pool.query<Dispute>(
			`SELECT d.* FROM disputes d
			 JOIN dispute_jurors dj ON dj.dispute_id = d.dispute_id
			 WHERE dj.juror_address = $1
			 ORDER BY d.opened_at DESC`,
			[jurorAddress],
		)
		return result.rows
	},

	async getDisputeByMilestone(
		proposalId: number,
		milestoneId: number,
	): Promise<Dispute | null> {
		const result = await pool.query<Dispute>(
			`SELECT * FROM disputes WHERE proposal_id = $1 AND milestone_id = $2`,
			[proposalId, milestoneId],
		)
		return result.rows[0] ?? null
	},
}
