// Contract IDs read from env vars — undefined if not deployed yet
export const CONTRACT_IDS = {
	learnToken: import.meta.env.VITE_LEARN_TOKEN_CONTRACT_ID as
		| string
		| undefined,
	governanceToken: import.meta.env.VITE_GOVERNANCE_TOKEN_CONTRACT_ID as
		| string
		| undefined,
	scholarNft: import.meta.env.VITE_SCHOLAR_NFT_CONTRACT_ID as
		| string
		| undefined,
	courseMilestone: import.meta.env.VITE_COURSE_MILESTONE_CONTRACT_ID as
		| string
		| undefined,
	scholarshipTreasury: import.meta.env.VITE_SCHOLARSHIP_TREASURY_CONTRACT_ID as
		| string
		| undefined,
	milestoneEscrow: import.meta.env.VITE_MILESTONE_ESCROW_CONTRACT_ID as
		| string
		| undefined,
} as const
