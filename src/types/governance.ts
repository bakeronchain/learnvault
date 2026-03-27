/**
 * Governance-related TypeScript interfaces.
 *
 * `Proposal` is the canonical client-side representation used by the UI.
 * `RawContractProposal` mirrors the on-chain ScholarshipTreasury
 * `Proposal` struct so the mapping layer is fully typed.
 */

// ---------------------------------------------------------------------------
// Client-side proposal (used by UI components)
// ---------------------------------------------------------------------------

export interface Proposal {
	id: number
	title: string
	description: string
	author: string
	status: "Active" | "Passed" | "Rejected"
	votesFor: bigint
	votesAgainst: bigint
	endDate: number // ledger sequence or unix timestamp
}

// ---------------------------------------------------------------------------
// Raw contract response
//
// Mirrors the on-chain `Proposal` struct from scholarship_treasury.
// Some Soroban client generators use camelCase; we accept both forms.
// ---------------------------------------------------------------------------

export interface RawContractProposal {
	id?: number | bigint
	applicant?: string
	amount?: number | bigint
	program_name?: string
	program_url?: string
	program_description?: string
	start_date?: string
	milestone_titles?: string[]
	milestone_dates?: string[]
	submitted_at?: number | bigint
	yes_votes?: number | bigint
	no_votes?: number | bigint
	deadline_ledger?: number

	// camelCase aliases emitted by some generated clients
	title?: string
	description?: string
	author?: string
	author_address?: string
	status?: string
	votes_for?: number | bigint
	votesFor?: number | bigint
	votes_against?: number | bigint
	votesAgainst?: number | bigint
	end_date?: number
	endDate?: number
}
