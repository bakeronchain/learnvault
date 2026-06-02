import { CONTRACT_IDS } from "../constants/contracts"

const normalizeContractId = (value: string | undefined): string | undefined => {
	const trimmed = value?.trim()
	return trimmed || undefined
}

export function useContractIds() {
	const learnToken = normalizeContractId(CONTRACT_IDS.learnToken)
	const governanceToken = normalizeContractId(CONTRACT_IDS.governanceToken)
	const scholarNft = normalizeContractId(CONTRACT_IDS.scholarNft)
	const courseMilestone = normalizeContractId(CONTRACT_IDS.courseMilestone)
	const scholarshipTreasury = normalizeContractId(
		CONTRACT_IDS.scholarshipTreasury,
	)
	const milestoneEscrow = normalizeContractId(CONTRACT_IDS.milestoneEscrow)
	const usdc =
		normalizeContractId(import.meta.env.PUBLIC_USDC_CONTRACT_ID as string) ??
		normalizeContractId(import.meta.env.VITE_USDC_CONTRACT_ID as string)

	return {
		learnToken,
		governanceToken,
		scholarNft,
		courseMilestone,
		scholarshipTreasury,
		milestoneEscrow,
		usdc,
		isDeployed: (id: string | undefined): id is string => Boolean(id),
	}
}
