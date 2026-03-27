import { z } from "zod"

// Event config - contract IDs from env
export const CONTRACT_IDS = {
	learnToken: process.env.LEARN_TOKEN_CONTRACT_ID!,
	courseMilestone: process.env.COURSE_MILESTONE_CONTRACT_ID!,
	scholarshipTreasury: process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID!,
	milestoneEscrow: process.env.MILESTONE_ESCROW_CONTRACT_ID!,
	scholarNft: process.env.SCHOLAR_NFT_CONTRACT_ID!,
} as const

export type ContractName = keyof typeof CONTRACT_IDS

// Event topics (contract::topic)
export const EVENT_TOPICS = {
	LearnToken_Mint: "LearnToken::Mint",
	CourseMilestone_MilestoneComplete: "CourseMilestone::MilestoneComplete",
	ScholarshipTreasury_Deposit: "ScholarshipTreasury::Deposit",
	ScholarshipTreasury_ProposalCreated: "ScholarshipTreasury::ProposalCreated",
	ScholarshipTreasury_VoteCast: "ScholarshipTreasury::VoteCast",
	MilestoneEscrow_FundsDisbursed: "MilestoneEscrow::FundsDisbursed",
	ScholarNft_Minted: "ScholarNFT::minted",
	ScholarNft_Revoked: "ScholarNFT::revoked",
} as const

export type EventTopic = keyof typeof EVENT_TOPICS
export type EventTopicValue = (typeof EVENT_TOPICS)[EventTopic]

// Events to index: contract -> topics[]
export const EVENTS_TO_INDEX: Record<ContractName, EventTopic[]> = {
	learnToken: ["LearnToken_Mint"],
	courseMilestone: ["CourseMilestone_MilestoneComplete"],
	scholarshipTreasury: [
		"ScholarshipTreasury_Deposit",
		"ScholarshipTreasury_ProposalCreated",
		"ScholarshipTreasury_VoteCast",
	],
	milestoneEscrow: ["MilestoneEscrow_FundsDisbursed"],
	scholarNft: ["ScholarNft_Minted", "ScholarNft_Revoked"],
} as const

// Zod schemas for event data parsing (extend as needed)
export const EVENT_DATA_SCHEMAS: Partial<Record<EventTopicValue, z.ZodSchema>> =
	{
		"LearnToken::Mint": z.object({
			address: z.string(),
			amount: z.string().regex(/^\d+$/), // uint128 as string
		}),
		"CourseMilestone::MilestoneComplete": z.object({
			address: z.string(),
			courseId: z.string(),
			milestoneId: z.string().regex(/^\d+$/), // u32
		}),
		"ScholarNFT::minted": z.object({
			token_id: z.string().regex(/^\d+$/),
			owner: z.string(),
		}),
		"ScholarNFT::revoked": z.object({
			token_id: z.string().regex(/^\d+$/),
			reason: z.string(),
		}),
		// Add others...
	}

// DB Event row
export const DB_EVENT_SCHEMA = z.object({
	id: z.number(),
	contract: z.string(),
	event_type: z.string(),
	data: z.record(z.unknown()),
	ledger_sequence: z.bigint(),
	created_at: z.string().datetime(),
})

// API response
export type ApiEvent = z.infer<typeof DB_EVENT_SCHEMA> & {
	// Add computed fields if needed
}
