import { useQuery } from "@tanstack/react-query"
import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"

import ConnectWalletGuard from "../components/ConnectWalletGuard"
import { useDelegation } from "../hooks/useDelegation"
import { useProposals } from "../hooks/useProposals"
import { useSponsorDeposit } from "../hooks/useSponsorDeposit"
import { useUSDC } from "../hooks/useUSDC"
import { useWallet } from "../hooks/useWallet"
import { getDepositsForAddress } from "../services/sponsor-api"

const TOKEN_SCALE = 10_000_000n

const formatAtomicToken = (amount: bigint): string => {
	const whole = amount / TOKEN_SCALE
	const fraction = amount % TOKEN_SCALE
	if (fraction === 0n) return whole.toString()
	return `${whole}.${fraction.toString().padStart(7, "0").replace(/0+$/, "")}`
}

function SponsorDashboard({ address }: { address: string }) {
	const [amount, setAmount] = useState("")
	const [delegatee, setDelegatee] = useState("")
	const { balance: usdcBalance, isLoading: isUsdcLoading } = useUSDC(address)
	const {
		votingPower,
		proposals,
		isLoading: isProposalsLoading,
	} = useProposals()
	const { deposit, isDepositing } = useSponsorDeposit()
	const {
		delegateTo,
		isUpdating,
		delegatee: currentDelegatee,
	} = useDelegation()
	const { data: deposits = [] } = useQuery({
		queryKey: ["sponsor", "deposits", address],
		queryFn: () => getDepositsForAddress(address),
	})
	const activeProposals = proposals.filter((proposal) => proposal.isVotingOpen)

	const submitDeposit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		try {
			await deposit(amount)
			setAmount("")
		} catch {
			// The deposit hook reports actionable errors through the shared toast.
		}
	}

	const submitDelegation = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		try {
			await delegateTo(delegatee.trim())
			setDelegatee("")
		} catch {
			// The delegation hook reports actionable errors through the shared toast.
		}
	}

	return (
		<div className="mx-auto max-w-5xl p-8 text-white">
			<h1 className="mb-8 text-4xl font-black">Sponsor Portal</h1>

			<section className="mb-8 grid gap-4 sm:grid-cols-2" aria-label="Balances">
				<div className="glass-card rounded-3xl p-6">
					<p className="text-sm text-white/50">USDC balance</p>
					<p className="text-3xl font-black">
						{isUsdcLoading ? "Loading…" : `${usdcBalance ?? 0} USDC`}
					</p>
				</div>
				<div className="glass-card rounded-3xl p-6">
					<p className="text-sm text-white/50">GOV balance</p>
					<p className="text-3xl font-black">
						{formatAtomicToken(votingPower)} GOV
					</p>
				</div>
			</section>

			<div className="mb-8 grid gap-6 md:grid-cols-2">
				<form
					className="glass-card rounded-3xl p-6"
					onSubmit={(event) => void submitDeposit(event)}
				>
					<h2 className="mb-4 text-xl font-bold">Deposit to treasury</h2>
					<label className="mb-2 block text-sm" htmlFor="sponsor-usdc-amount">
						USDC amount
					</label>
					<input
						id="sponsor-usdc-amount"
						type="text"
						inputMode="decimal"
						value={amount}
						onChange={(event) => setAmount(event.target.value)}
						className="mb-4 w-full rounded-xl border border-white/10 bg-white/5 p-3"
					/>
					<button
						type="submit"
						disabled={isDepositing || !amount.trim()}
						className="rounded-xl bg-brand-cyan px-5 py-3 font-bold text-black disabled:opacity-50"
					>
						{isDepositing ? "Confirm in Freighter…" : "Deposit USDC"}
					</button>
				</form>

				<form
					className="glass-card rounded-3xl p-6"
					onSubmit={(event) => void submitDelegation(event)}
				>
					<h2 className="mb-4 text-xl font-bold">Delegate voting power</h2>
					{currentDelegatee && (
						<p className="mb-3 text-sm text-white/60">
							Currently delegated to {currentDelegatee}
						</p>
					)}
					<label className="mb-2 block text-sm" htmlFor="delegate-address">
						Delegate address
					</label>
					<input
						id="delegate-address"
						type="text"
						value={delegatee}
						onChange={(event) => setDelegatee(event.target.value)}
						className="mb-4 w-full rounded-xl border border-white/10 bg-white/5 p-3"
					/>
					<button
						type="submit"
						disabled={isUpdating || !delegatee.trim()}
						className="rounded-xl bg-brand-purple px-5 py-3 font-bold disabled:opacity-50"
					>
						{isUpdating ? "Confirm in Freighter…" : "Delegate power"}
					</button>
				</form>
			</div>

			<section className="glass-card mb-8 rounded-3xl p-6">
				<h2 className="mb-4 text-xl font-bold">Active proposals</h2>
				{isProposalsLoading ? (
					<p>Loading…</p>
				) : activeProposals.length === 0 ? (
					<p className="text-white/60">No active proposals.</p>
				) : (
					<ul className="space-y-3">
						{activeProposals.map((proposal) => (
							<li key={proposal.id}>
								<Link
									to={`/dao/proposals?proposal=${proposal.id}`}
									className="text-brand-cyan hover:underline"
								>
									{proposal.title}
								</Link>
							</li>
						))}
					</ul>
				)}
			</section>

			<section className="glass-card rounded-3xl p-6">
				<h2 className="mb-4 text-xl font-bold">Deposit history</h2>
				{deposits.length === 0 ? (
					<p className="text-white/60">No deposits recorded.</p>
				) : (
					<ul className="space-y-3">
						{deposits.map((entry) => (
							<li key={entry.id} className="flex justify-between gap-4">
								<span>{entry.amount_usdc} USDC</span>
								<span>{entry.gov_issued} GOV</span>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	)
}

export default function SponsorPortal() {
	const { address } = useWallet()

	return (
		<ConnectWalletGuard>
			{address ? <SponsorDashboard address={address} /> : null}
		</ConnectWalletGuard>
	)
}
