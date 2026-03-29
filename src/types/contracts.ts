/**
 * Consolidated contract-related TypeScript interfaces used across the
 * frontend. This file intentionally includes both the existing runtime-lean
 * helper types (DonorData, Vote, etc.) as well as the new canonical
 * on-chain shapes requested in the issue so other modules can import a
 * single source of truth.
 */

// ---------------------------------------------------------------------------
// Canonical on-chain / shared contract types (as requested)
// ---------------------------------------------------------------------------
export interface Proposal {
	id: number
	proposer: string
	amount: bigint
	description: string
	votes_for: bigint
	votes_against: bigint
	status: "pending" | "approved" | "rejected"
}

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

export interface LearnTokenInfo {
	balance: bigint
	reputation_score: bigint
	total_supply: bigint
}
export type { Proposal, RawContractProposal } from "./governance"

// ---------------------------------------------------------------------------
// Milestone types (on-chain CourseMilestone)
// ---------------------------------------------------------------------------
export type { MilestoneReportFormValues, SubmittedMilestoneReport } from "./milestone"
export type {
	MilestoneReportFormValues,
	SubmittedMilestoneReport,
} from "./milestone"

// ---------------------------------------------------------------------------
// Existing app-specific helper types kept for backward compatibility with
// current hooks and components in the repo. These mirror the previous
// contents of this file so consumers that expect `DonorData`, `Vote`, etc.
// continue to function while we migrate other modules to the canonical
// interfaces above.
// ---------------------------------------------------------------------------
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

// Re-export some legacy, more-detailed governance types from the dedicated
// governance file so consumers that rely on the raw contract shape can still
// import them via the single barrel when needed.
export { RawContractProposal } from "./governance"
