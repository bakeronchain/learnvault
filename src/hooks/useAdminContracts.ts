import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
	getCourseMilestoneState,
	getScholarshipTreasuryState,
	invokeContractMethod,
	type AdminManagedContractState,
} from "../util/sorobanAdmin"
import { useContractIds } from "./useContractIds"
import { useWallet } from "./useWallet"

export interface ContractRegistryEntry {
	key: string
	name: string
	contractId?: string
}

export interface AdminContractsSnapshot {
	registry: ContractRegistryEntry[]
	scholarshipTreasuryState: AdminManagedContractState | null
	courseMilestoneState: AdminManagedContractState | null
}

const CONTRACT_QUERY_KEY = ["admin", "contracts"] as const

export function useAdminContracts() {
	const contractIds = useContractIds()

	return useQuery({
		queryKey: [
			...CONTRACT_QUERY_KEY,
			contractIds.learnToken,
			contractIds.governanceToken,
			contractIds.scholarNft,
			contractIds.courseMilestone,
			contractIds.scholarshipTreasury,
			contractIds.milestoneEscrow,
			contractIds.usdc,
		],
		queryFn: async (): Promise<AdminContractsSnapshot> => {
			const registry: ContractRegistryEntry[] = [
				{
					key: "learnToken",
					name: "Learn Token",
					contractId: contractIds.learnToken,
				},
				{
					key: "governanceToken",
					name: "Governance Token",
					contractId: contractIds.governanceToken,
				},
				{
					key: "courseMilestone",
					name: "Course Milestone",
					contractId: contractIds.courseMilestone,
				},
				{
					key: "milestoneEscrow",
					name: "Milestone Escrow",
					contractId: contractIds.milestoneEscrow,
				},
				{
					key: "scholarshipTreasury",
					name: "Scholarship Treasury",
					contractId: contractIds.scholarshipTreasury,
				},
				{
					key: "scholarNft",
					name: "Scholar NFT",
					contractId: contractIds.scholarNft,
				},
				{
					key: "usdc",
					name: "USDC Token",
					contractId: contractIds.usdc,
				},
			]

			const [scholarshipTreasuryState, courseMilestoneState] =
				await Promise.all([
					contractIds.scholarshipTreasury
						? getScholarshipTreasuryState(
								contractIds.scholarshipTreasury,
							).catch(() => null)
						: Promise.resolve(null),
					contractIds.courseMilestone
						? getCourseMilestoneState(contractIds.courseMilestone).catch(
								() => null,
							)
						: Promise.resolve(null),
				])

			return {
				registry,
				scholarshipTreasuryState,
				courseMilestoneState,
			}
		},
		staleTime: 60 * 1000,
	})
}

export function useTreasuryPauseControl() {
	const queryClient = useQueryClient()
	const { address, signTransaction } = useWallet()
	const { scholarshipTreasury } = useContractIds()
	const mutation = useMutation({
		mutationFn: async (methodName: "pause" | "unpause") => {
			if (!scholarshipTreasury) {
				throw new Error("Scholarship treasury contract is not configured")
			}
			if (!address) {
				throw new Error("Connect your wallet before managing the treasury")
			}

			return invokeContractMethod({
				contractId: scholarshipTreasury,
				methodName,
				sourceAddress: address,
				signTransaction,
			})
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: CONTRACT_QUERY_KEY,
			})
		},
	})

	return {
		isPending: mutation.isPending,
		error: mutation.error instanceof Error ? mutation.error.message : null,
		pauseTreasury: () => mutation.mutateAsync("pause"),
		unpauseTreasury: () => mutation.mutateAsync("unpause"),
	}
}
