type EnvRecord = Record<string, string | undefined>

const env = import.meta.env as EnvRecord

const readContractId = (...keys: string[]): string | undefined => {
	for (const key of keys) {
		const value = env[key]?.trim()
		if (value) return value
	}

	return undefined
}

// Contract IDs read from env vars or legacy public aliases.
export const CONTRACT_IDS = {
	learnToken: readContractId(
		"VITE_LEARN_TOKEN_CONTRACT_ID",
		"PUBLIC_LEARN_TOKEN_CONTRACT",
		"PUBLIC_LEARN_TOKEN_CONTRACT_ID",
	),
	governanceToken: readContractId(
		"VITE_GOVERNANCE_TOKEN_CONTRACT_ID",
		"PUBLIC_GOVERNANCE_TOKEN_CONTRACT",
		"PUBLIC_GOVERNANCE_TOKEN_CONTRACT_ID",
	),
	scholarNft: readContractId(
		"VITE_SCHOLAR_NFT_CONTRACT_ID",
		"PUBLIC_SCHOLAR_NFT_CONTRACT",
		"PUBLIC_SCHOLAR_NFT_CONTRACT_ID",
	),
	courseMilestone: readContractId(
		"VITE_COURSE_MILESTONE_CONTRACT_ID",
		"PUBLIC_COURSE_MILESTONE_CONTRACT",
		"PUBLIC_COURSE_MILESTONE_CONTRACT_ID",
	),
	scholarshipTreasury: readContractId(
		"VITE_SCHOLARSHIP_TREASURY_CONTRACT_ID",
		"PUBLIC_SCHOLARSHIP_TREASURY_CONTRACT",
		"PUBLIC_SCHOLARSHIP_TREASURY_CONTRACT_ID",
	),
	milestoneEscrow: readContractId(
		"VITE_MILESTONE_ESCROW_CONTRACT_ID",
		"PUBLIC_MILESTONE_ESCROW_CONTRACT",
		"PUBLIC_MILESTONE_ESCROW_CONTRACT_ID",
	),
} as const
