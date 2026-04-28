/**
 * Consolidated contract-related TypeScript interfaces used across the frontend.
 */

export type { Proposal, RawContractProposal } from "./governance"

export type {
	MilestoneReportFormValues,
	SubmittedMilestoneReport,
} from "./milestone"

export interface MilestoneReport {
	id: string
	learner_address: string
	course_id: string
	milestone_id: number
	evidence_url: string
	status: "pending" | "verified" | "rejected"
}

export interface ScholarCredential {
	token_id: bigint
	owner: string
	course_id: string
	issued_at: number
	metadata_uri: string
}

export interface DonorStats {
	total_contributed: bigint
	votes_cast: number
	scholars_funded: number
}

export interface DonorImpact {
	total_donated_usdc: string
	scholars_funded: number
	milestones_completed: number
	average_completion_rate: number
}

export interface LearnTokenInfo {
	balance: bigint
	reputation_score: bigint
	total_supply: bigint
}

export interface DonorContribution {
	txHash: string
	amount: number
	date: string
	block: number
}

export interface Vote {
	proposalId: string
	proposalTitle: string
	voteChoice: "for" | "against"
	votePower: number
	status: "active" | "passed" | "rejected"
}

export interface Scholar {
	id: string
	name: string
	proposalAmount: number
	fundedPercentage: number
	progressPercentage: number
	status: "active" | "completed"
}

export interface DonorData {
	stats: DonorStats
	impact: DonorImpact | null
	contributions: DonorContribution[]
	votes: Vote[]
	scholars: Scholar[]
	isLoading: boolean
	error: string | null
	isEmpty: boolean
}

export interface RpcEvent {
	id?: string
	ledger?: number
	ledgerCloseTime?: string
	txHash?: string
	topic?: unknown[]
	topics?: unknown[]
	value?: unknown
}
