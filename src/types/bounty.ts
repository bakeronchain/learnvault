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

export interface BountyListResponse {
	data: Bounty[]
	pagination: {
		page: number
		pageSize: number
		total: number
		totalPages: number
	}
}

export interface BountyDetailResponse {
	bounty: Bounty
	submission: BountySubmission | null
}

export interface CreateBountyPayload {
	title: string
	description: string
	skillTags: string[]
	rewardUsdc: string
	escrowTx: string
	claimDurationHours?: number
}

export interface SubmitWorkPayload {
	repoUrl?: string
	notes?: string
}
