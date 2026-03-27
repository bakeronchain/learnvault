import { rpcUrl, networkPassphrase } from "../contracts/util"
import { useWallet } from "../hooks/useWallet"

export interface ScholarshipTreasuryContract {
	createProposal: (
		params: CreateProposalParams,
		address?: string,
	) => Promise<string>
	getGovernanceTokenBalance: (address: string) => Promise<number>
	getMinimumProposalTokens: () => Promise<number>
}

export interface CreateProposalParams {
	title: string
	description: string
	proposalType: "scholarship" | "parameter_change" | "new_course"
	typeSpecificData: {
		applicationUrl?: string
		fundingAmount?: number
		parameterName?: string
		parameterValue?: string
		parameterReason?: string
		courseTitle?: string
		courseDescription?: string
		courseDuration?: number
		courseDifficulty?: string
	}
}

export class ScholarshipTreasury implements ScholarshipTreasuryContract {
	private contractId: string
	private address: string | null

	constructor(contractId: string, address: string | null = null) {
		this.contractId = contractId
		this.address = address
	}

	async createProposal(
		params: CreateProposalParams,
		_address?: string,
	): Promise<string> {
		try {
			const mockTxHash = `PROPOSAL_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

			console.log("Creating proposal with params:", params)
			console.log("Contract ID:", this.contractId)
			console.log("Submitting from address:", this.address)

			// Simulate contract call delay
			await new Promise((resolve) => setTimeout(resolve, 1500))

			return mockTxHash
		} catch (error) {
			console.error("Failed to create proposal:", error)
			throw new Error("Failed to submit proposal to contract")
		}
	}

	async getGovernanceTokenBalance(_userAddress: string): Promise<number> {
		try {
			return 128.45
		} catch (error) {
			console.error("Failed to get governance token balance:", error)
			return 0
		}
	}

	async getMinimumProposalTokens(): Promise<number> {
		try {
			return 10
		} catch (error) {
			console.error("Failed to get minimum proposal tokens:", error)
			return 10
		}
	}

	async getProposalDetails(_proposalId: string): Promise<unknown> {
		throw new Error("Not implemented")
	}

	async voteOnProposal(_proposalId: string, _vote: boolean): Promise<string> {
		throw new Error("Not implemented")
	}
}

// Contract factory function
export const createScholarshipTreasuryContract = (
	contractId: string,
	address: string | null = null,
): ScholarshipTreasury => {
	return new ScholarshipTreasury(contractId, address)
}

export const SCHOLARSHIP_TREASURY_CONTRACT_ID =
	"CB7N4QZJ5K7GYRJAFV4JGHQZP2S5F2ZQ6YR7F4QZJ5K7GYRJAFV4JGHQZP2S5F2ZQ"

export const useScholarshipTreasury = () => {
	const { address } = useWallet()
	const contract = createScholarshipTreasuryContract(
		SCHOLARSHIP_TREASURY_CONTRACT_ID,
		address ?? null,
	)

	return {
		contract,
		createProposal: contract.createProposal.bind(contract),
		getGovernanceTokenBalance:
			contract.getGovernanceTokenBalance.bind(contract),
		getMinimumProposalTokens: contract.getMinimumProposalTokens.bind(contract),
		isConnected: !!address,
		userAddress: address,
	}
}
