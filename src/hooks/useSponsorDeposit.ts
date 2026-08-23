import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "../components/Toast/ToastProvider"
import { depositToTreasury } from "../services/sponsor-api"
import { createScholarshipTreasuryContract } from "../util/scholarshipTreasury"
import { useContractIds } from "./useContractIds"
import { useWallet } from "./useWallet"

const USDC_DECIMAL_PATTERN = /^\d+(\.\d{1,7})?$/

export function useSponsorDeposit() {
	const { address, signTransaction, updateBalances } = useWallet()
	const { scholarshipTreasury, usdc } = useContractIds()
	const { showSuccess, showError, showInfo } = useToast()
	const queryClient = useQueryClient()

	const mutation = useMutation({
		mutationFn: async (amount: string) => {
			if (!address) {
				throw new Error("Connect your wallet before depositing")
			}

			if (!scholarshipTreasury || !usdc) {
				throw new Error(
					"Treasury or USDC contract not configured for this network",
				)
			}

			const trimmedAmount = amount.trim()

			if (!USDC_DECIMAL_PATTERN.test(trimmedAmount)) {
				throw new Error(
					"Invalid amount format. Use numbers with up to 7 decimal places.",
				)
			}

			const numAmount = Number(trimmedAmount)
			if (numAmount <= 0) {
				throw new Error("Deposit amount must be greater than 0")
			}

			if (typeof signTransaction !== "function") {
				throw new Error("Wallet does not support signing")
			}

			showInfo("Confirming transaction on-chain...")
			const contract = createScholarshipTreasuryContract(
				scholarshipTreasury,
				address,
			)
			const txHash = await contract.deposit(
				trimmedAmount,
				usdc,
				signTransaction,
			)

			try {
				await depositToTreasury({
					donorAddress: address,
					amount: numAmount,
					txHash,
				})
			} catch (auditError) {
				throw new Error(
					`Transaction confirmed (${txHash}) but audit failed: ${auditError instanceof Error ? auditError.message : "Unknown error"}`,
				)
			}

			await updateBalances()

			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["usdc"] }),
				queryClient.invalidateQueries({
					queryKey: ["proposals", "votingPower", address],
				}),
				queryClient.invalidateQueries({
					queryKey: ["sponsor", "deposits", address],
				}),
			])

			return txHash
		},
		onSuccess: (txHash: string) => {
			showSuccess(
				`Deposit successful! Transaction: ${txHash.slice(0, 8)}...${txHash.slice(-6)}`,
			)
		},
		onError: (error: unknown) => {
			showError(
				error instanceof Error
					? error.message
					: "Deposit failed. Please try again.",
			)
		},
	})

	return {
		deposit: (amount: string) => mutation.mutateAsync(amount),
		isDepositing: mutation.isPending,
	}
}
