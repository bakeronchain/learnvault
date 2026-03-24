import React, { useState } from "react"
import { useNotification } from "../../hooks/useNotification"
import { useWallet } from "../../hooks/useWallet"

interface DepositMoreProps {
	onDepositSuccess?: () => void
}

export const DepositMore: React.FC<DepositMoreProps> = ({
	onDepositSuccess,
}) => {
	const [amount, setAmount] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const { address, signTransaction } = useWallet()
	const { addNotification } = useNotification()

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
			addNotification("Please connect your wallet", "error")
			return
		}

		if (!amount || parseFloat(amount) <= 0) {
			addNotification("Please enter a valid amount", "error")
			return
		}

		setIsLoading(true)
		try {
			// In a real implementation, this would:
			// 1. Create a transaction to approve USDC transfer
			// 2. Create a transaction to call treasury deposit
			// 3. Sign both transactions
			// 4. Submit to the network

			// For now, simulate the transaction flow
			const depositAmount = parseFloat(amount)

			if (!signTransaction) {
				addNotification("Wallet does not support signing", "error")
				setIsLoading(false)
				return
			}

			addNotification(
				`Deposit of $${depositAmount.toLocaleString()} USDC submitted!`,
				"success",
			)
			setAmount("")

			if (onDepositSuccess) {
				onDepositSuccess()
			}
		} catch (_error) {
			addNotification("Failed to process deposit. Please try again.", "error")
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

					<p className="text-[10px] text-white/30 text-center mt-6">
						✓ Deposits are secured on the Stellar blockchain
						<br />
						✓ You'll receive governance tokens immediately
						<br />✓ Your funds support eligible scholar proposals
					</p>
				</div>
			</form>
		</section>
	)
}
