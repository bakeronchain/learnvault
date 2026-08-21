import { Contract, nativeToScVal } from "@stellar/stellar-sdk"
import { networkPassphrase, rpcUrl } from "../contracts/util"
import { useWallet } from "../hooks/useWallet"
import {
	SCHOLARSHIP_TREASURY_CONTRACT,
	amountToAtomicUnits,
} from "./scholarshipApplications"
import { prepareAndConfirmTransaction } from "./soroban-transaction"

type WalletSignTransaction =
	| ((
			xdr: string,
			opts?: { networkPassphrase?: string; address?: string; path?: string },
	  ) => Promise<{ signedTxXdr: string; signerAddress?: string }>)
	| undefined

export interface ScholarshipTreasuryContract {
	createProposal: (
		params: CreateProposalParams,
		address?: string,
	) => Promise<string>
	deposit: (
		amount: string,
		assetContractId: string,
		signTransaction: WalletSignTransaction,
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

const readEnv = (key: string): string | undefined => {
	const value = (import.meta.env as Record<string, unknown>)[key]
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: undefined
}

const formatUnknownError = (value: unknown): string => {
	if (value instanceof Error) return value.message
	if (typeof value === "string") return value
	try {
		return JSON.stringify(value)
	} catch {
		return "Transaction failed"
	}
}

const getScholarshipTreasuryContractId = (): string | undefined =>
	readEnv("VITE_SCHOLARSHIP_TREASURY_CONTRACT_ID") ??
	SCHOLARSHIP_TREASURY_CONTRACT

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
			void params
			void _address
			const mockTxHash = `PROPOSAL_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
			await new Promise((resolve) => setTimeout(resolve, 1500))
			return mockTxHash
		} catch (error) {
			console.error("Failed to create proposal:", error)
			throw new Error("Failed to submit proposal to contract")
		}
	}

	async deposit(
		amount: string,
		assetContractId: string,
		signTransaction: WalletSignTransaction,
	): Promise<string> {
		if (!this.address) {
			throw new Error("Connect your wallet before depositing")
		}

		if (!this.contractId) {
			throw new Error(
				"Scholarship treasury contract is not configured for this environment",
			)
		}

		if (!assetContractId) {
			throw new Error("Asset contract address is required")
		}

		if (typeof signTransaction !== "function") {
			throw new Error("Wallet does not support signing")
		}

		const atomicAmount = amountToAtomicUnits(amount)
		if (atomicAmount <= 0n) {
			throw new Error("Deposit amount must be greater than 0")
		}

		try {
			const contract = new Contract(this.contractId)
			const operation = contract.call(
				"deposit",
				nativeToScVal(this.address, { type: "address" }),
				nativeToScVal(atomicAmount, { type: "i128" }),
				nativeToScVal(assetContractId, { type: "address" }),
			)

			return await prepareAndConfirmTransaction({
				operation,
				address: this.address,
				networkPassphrase,
				rpcUrl,
				signTransaction,
			})
		} catch (error) {
			console.error("Failed to deposit into scholarship treasury:", error)
			throw new Error(formatUnknownError(error))
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

export const createScholarshipTreasuryContract = (
	contractId: string,
	address: string | null = null,
): ScholarshipTreasury => {
	return new ScholarshipTreasury(contractId, address)
}

export const SCHOLARSHIP_TREASURY_CONTRACT_ID =
	getScholarshipTreasuryContractId() ?? ""

export const useScholarshipTreasury = () => {
	const { address } = useWallet()
	const contract = createScholarshipTreasuryContract(
		SCHOLARSHIP_TREASURY_CONTRACT_ID,
		address ?? null,
	)

	return {
		contract,
		createProposal: contract.createProposal.bind(contract),
		deposit: contract.deposit.bind(contract),
		getGovernanceTokenBalance:
			contract.getGovernanceTokenBalance.bind(contract),
		getMinimumProposalTokens: contract.getMinimumProposalTokens.bind(contract),
		isConnected: !!address,
		userAddress: address,
	}
}
