/**
 * Contract-related TypeScript interfaces.
 *
 * Single barrel file consolidating all on-chain contract data structures
 * used across the application — governance, donor, and milestone types.
 */

// ---------------------------------------------------------------------------
// Governance types (on-chain ScholarshipTreasury)
// ---------------------------------------------------------------------------
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
// Donor & contribution types (derived from contract events)
// ---------------------------------------------------------------------------

export interface DonorContribution {
	txHash: string
	amount: number
	date: string
	block: number
}

export interface DonorStats {
	totalContributed: number
	governanceBalance: number
	governancePercentage: number
	proposalsVoted: number
	scholarsFunded: number
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
