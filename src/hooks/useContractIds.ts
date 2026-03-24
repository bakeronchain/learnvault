const normalizeContractId = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed || undefined
}

export function useContractIds() {
  const learnToken = normalizeContractId(import.meta.env.VITE_LEARN_TOKEN_CONTRACT_ID as string | undefined)
  const governanceToken = normalizeContractId(
    import.meta.env.VITE_GOVERNANCE_TOKEN_CONTRACT_ID as string | undefined,
  )
  const scholarNft = normalizeContractId(import.meta.env.VITE_SCHOLAR_NFT_CONTRACT_ID as string | undefined)
  const courseMilestone = normalizeContractId(import.meta.env.VITE_COURSE_MILESTONE_CONTRACT_ID as string | undefined)
  const scholarshipTreasury = normalizeContractId(
    import.meta.env.VITE_SCHOLARSHIP_TREASURY_CONTRACT_ID as string | undefined,
  )
  const milestoneEscrow = normalizeContractId(import.meta.env.VITE_MILESTONE_ESCROW_CONTRACT_ID as string | undefined)
  const usdc = normalizeContractId(import.meta.env.VITE_USDC_CONTRACT_ID as string | undefined)

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
