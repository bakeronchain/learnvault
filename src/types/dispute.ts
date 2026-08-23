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

export interface DisputeDetail extends Dispute {
	jurors: DisputeJuror[]
	votes: DisputeVote[]
}

export interface DisputeListResponse {
	data: Dispute[]
	pagination: {
		page: number
		pageSize: number
		total: number
		totalPages: number
	}
}

export interface DisputeDetailResponse {
	data: DisputeDetail
}

export interface JurorAssignmentsResponse {
	data: Dispute[]
}
