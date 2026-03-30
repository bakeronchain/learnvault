import React, { useState } from "react"
import { useContractIds } from "../../hooks/useContractIds"
import { useWallet } from "../../hooks/useWallet"
import {
	explorerTransactionUrl,
	formatUsdcAmount,
} from "../../util/scholarshipApplications"
import {
	SCHOLARSHIP_TREASURY_CONTRACT_ID,
	createScholarshipTreasuryContract,
} from "../../util/scholarshipTreasury"
import { useToast } from "../Toast/ToastProvider"

interface DepositMoreProps {
	onDepositSuccess?: () => void
}

export const DepositMore: React.FC<DepositMoreProps> = ({
	onDepositSuccess,
}) => {
	const [amount, setAmount] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const [lastTxHash, setLastTxHash] = useState<string | null>(null)
	const { address, signTransaction, updateBalances } = useWallet()
	const { showSuccess, showError, showInfo } = useToast()

	const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value
		if (value === "" || /^\d+(\.\d{0,2})?$/.test(value)) {
			setAmount(value)
		}
	}

	const handleQuickAmount = (value: number) => {
		setAmount(value.toString())
	}

	const handleDeposit = async (e: React.FormEvent) => {
		e.preventDefault()

		if (!address) {
			showError("Please connect your wallet")
			return
		}

		if (!amount || parseFloat(amount) <= 0) {
			showError("Please enter a valid amount")
			return
		}

		if (!scholarshipTreasury) {
			showError("Scholarship treasury is not available on this network")
			return
		}

		if (!signTransaction) {
			showError("Wallet does not support signing")
			return
		}

		setIsLoading(true)
		setLastTxHash(null)
		try {
			showInfo("Waiting for wallet approval...")
			const scholarshipTreasury = createScholarshipTreasuryContract(
				SCHOLARSHIP_TREASURY_CONTRACT_ID,
				address,
			)
			const txHash = await scholarshipTreasury.deposit(amount, signTransaction)
			setLastTxHash(txHash)
			await updateBalances()
			showSuccess(
				`Deposit of ${formatUsdcAmount(amount)} submitted. Tx: ${txHash.slice(0, 8)}...`,
			const depositAmount = parseFloat(amount)
			const contract = createScholarshipTreasuryContract(
				scholarshipTreasury,
				address,
			)

			showInfo("Waiting for wallet approval...")
			const txHash = await contract.deposit(
				address,
				depositAmount,
				signTransaction,
			)

			showSuccess(
				`Deposit of $${depositAmount.toLocaleString()} USDC submitted!`,
				txHash || undefined,
			)
			setAmount("")
			onDepositSuccess?.()
		} catch (error) {
			if (isUserRejection(error)) {
				showInfo("Deposit cancelled")
				return
			}
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to process deposit. Please try again."
			showError(message)

			const appError = parseError(error)
			showError(
				appError.message && appError.message !== "An unexpected error occurred"
					? appError.message
					: "Failed to process deposit. Please try again.",
			)
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<section className="mb-20">
			<div className="flex items-center gap-4 mb-12">
				<h2 className="text-2xl font-black tracking-tight">Deposit More</h2>
				<div className="h-px flex-1 bg-linear-to-r from-white/10 to-transparent" />
			</div>

			<form onSubmit={handleDeposit}>
				<div className="glass-card p-12 rounded-[3rem] border border-white/5 max-w-2xl">
					<div className="mb-8">
						<label className="text-sm text-white/40 uppercase font-black tracking-widest block mb-4">
							Deposit Amount
						</label>
						<div className="relative">
							<span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-brand-cyan">
								$
							</span>
							<input
								type="text"
								value={amount}
								onChange={handleAmountChange}
								placeholder="0.00"
								className="w-full bg-white/5 border border-white/10 rounded-2xl px-12 py-4 text-2xl font-black text-white placeholder:text-white/20 focus:outline-none focus:border-brand-cyan/50 focus:ring-2 focus:ring-brand-cyan/20 transition-all"
							/>
							<span className="absolute right-6 top-1/2 -translate-y-1/2 text-sm font-black text-white/40 uppercase tracking-widest">
								USDC
							</span>
						</div>
					</div>

					<div className="mb-8">
						<p className="text-xs text-white/40 uppercase font-black tracking-widest mb-4">
							Quick Select
						</p>
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
							{[100, 500, 1000, 5000].map((value) => (
								<button
									key={value}
									type="button"
									onClick={() => handleQuickAmount(value)}
									className={`py-3 px-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all ${
										amount === value.toString()
											? "bg-brand-cyan text-black shadow-[0_0_20px_rgba(0,210,255,0.3)]"
											: "bg-white/5 border border-white/10 text-white/40 hover:text-white hover:border-white/30"
									}`}
								>
									${value}
								</button>
							))}
						</div>
					</div>

					<div className="h-px bg-white/5 mb-8" />

					<div className="mb-8 space-y-3">
						<div className="flex items-center justify-between text-sm">
							<span className="text-white/40">You will receive</span>
							<span className="font-black text-brand-cyan">
								{amount
									? `${parseFloat(amount).toLocaleString()} GOV`
									: "0.00 GOV"}
							</span>
						</div>
						<div className="flex items-center justify-between text-xs">
							<span className="text-white/30">Exchange rate</span>
							<span className="text-white/40">1 USDC = 1 GOV</span>
						</div>
					</div>

					<button
						type="submit"
						disabled={!address || !amount || isLoading}
						className={`w-full py-4 px-6 font-black uppercase tracking-widest rounded-2xl transition-all ${
							!address || !amount || isLoading
								? "bg-white/5 text-white/40 cursor-not-allowed"
								: "bg-brand-cyan text-black hover:shadow-[0_0_30px_rgba(0,210,255,0.4)] hover:scale-105 active:scale-95"
						}`}
					>
						{isLoading
							? "Processing..."
							: address
								? `Deposit ${amount ? `$${parseFloat(amount).toLocaleString()}` : "USDC"}`
								: "Connect Wallet to Deposit"}
					</button>

					{lastTxHash ? (
						<div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-4 text-sm text-emerald-100">
							<p className="text-[11px] font-black uppercase tracking-widest text-emerald-300">
								Deposit Submitted
							</p>
							<p className="mt-2 break-all font-mono text-xs text-emerald-50">
								Transaction: {lastTxHash}
							</p>
							<a
								href={explorerTransactionUrl(lastTxHash)}
								target="_blank"
								rel="noreferrer"
								className="mt-3 inline-flex text-xs font-black uppercase tracking-widest text-emerald-300 hover:text-emerald-200"
							>
								View on Stellar Explorer
							</a>
						</div>
					) : null}

					<p className="mt-6 text-center text-[10px] text-white/30">
						Deposits are secured on the Stellar blockchain
						<br />
						You&apos;ll receive governance tokens immediately
					<p className="text-[10px] text-white/30 text-center mt-6">
						Deposits are secured on the Stellar blockchain
						<br />
						You will receive governance tokens immediately
						<br />
						Your funds support eligible scholar proposals
					</p>
				</div>
			</form>
		</section>
	)
}
