import { Button, Card } from "@stellar/design-system"
import { useState } from "react"
import { Link } from "react-router-dom"
import { useToast } from "../components/Toast/ToastProvider"
import { useContractIds } from "../hooks/useContractIds"
import { useDisputes, useJurorAssignments } from "../hooks/useDisputes"
import { useWallet } from "../hooks/useWallet"
import { getStoredVote, saveVote } from "../lib/disputeVoteStorage"
import {
	bytesToHex,
	computeVoteCommitment,
	generateSalt,
	hexToBytes,
	submitCommitVote,
	submitJoinPanel,
	submitRevealVote,
} from "../lib/milestoneArbitrationContract"
import { type Dispute } from "../types/dispute"
import { shortenAddress } from "../util/scholarshipApplications"

const MIN_JUROR_STAKE_LRN = "1000"

function formatDeadline(iso: string): string {
	return new Date(iso).toLocaleString()
}

function DisputeCard({ dispute }: { dispute: Dispute }) {
	const { address, signTransaction } = useWallet()
	const { milestoneArbitration } = useContractIds()
	const { showSuccess, showError, showInfo } = useToast()
	const [isVoting, setIsVoting] = useState(false)

	const now = Date.now()
	const commitOpen = now <= new Date(dispute.commit_deadline).getTime()
	const revealOpen =
		now > new Date(dispute.commit_deadline).getTime() &&
		now <= new Date(dispute.reveal_deadline).getTime()

	const handleCommit = async (vote: boolean) => {
		if (!address || !signTransaction || !milestoneArbitration) {
			showError("Connect your wallet first.")
			return
		}
		setIsVoting(true)
		try {
			showInfo("Waiting for wallet approval...")
			const salt = generateSalt()
			const commitment = await computeVoteCommitment(
				BigInt(dispute.dispute_id),
				vote,
				salt,
			)
			await submitCommitVote({
				contractId: milestoneArbitration,
				disputeId: BigInt(dispute.dispute_id),
				jurorAddress: address,
				commitment,
				signTransaction,
			})
			saveVote(address, dispute.dispute_id, vote, bytesToHex(salt))
			showSuccess(
				"Vote committed. Keep this browser session -- your salt is stored locally and is required to reveal.",
			)
		} catch (err) {
			showError(err instanceof Error ? err.message : "Failed to commit vote.")
		} finally {
			setIsVoting(false)
		}
	}

	const handleReveal = async () => {
		if (!address || !signTransaction || !milestoneArbitration) {
			showError("Connect your wallet first.")
			return
		}
		const stored = getStoredVote(address, dispute.dispute_id)
		if (!stored) {
			showError(
				"No locally stored vote found for this dispute. Reveal must happen from the browser you committed from.",
			)
			return
		}
		setIsVoting(true)
		try {
			showInfo("Waiting for wallet approval...")
			await submitRevealVote({
				contractId: milestoneArbitration,
				disputeId: BigInt(dispute.dispute_id),
				jurorAddress: address,
				vote: stored.vote,
				salt: hexToBytes(stored.saltHex),
				signTransaction,
			})
			showSuccess("Vote revealed.")
		} catch (err) {
			showError(err instanceof Error ? err.message : "Failed to reveal vote.")
		} finally {
			setIsVoting(false)
		}
	}

	const storedVote = address ? getStoredVote(address, dispute.dispute_id) : null

	return (
		<div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Link
					to={`/disputes/${dispute.dispute_id}`}
					className="text-sm font-semibold text-brand-cyan underline"
				>
					Dispute #{dispute.dispute_id}
				</Link>
				<span
					className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
						dispute.phase === "active"
							? "bg-blue-500/10 text-blue-400"
							: dispute.phase === "resolved"
								? "bg-green-500/10 text-green-400"
								: "bg-yellow-500/10 text-yellow-400"
					}`}
				>
					{dispute.phase}
				</span>
			</div>
			<p className="mt-2 text-xs text-white/60">
				Proposal #{dispute.proposal_id} · Milestone #{dispute.milestone_id} ·
				Scholar {shortenAddress(dispute.scholar_address)}
			</p>
			<p className="mt-1 text-xs text-white/50">
				Commit by {formatDeadline(dispute.commit_deadline)} · Reveal by{" "}
				{formatDeadline(dispute.reveal_deadline)}
			</p>

			{dispute.phase === "active" && commitOpen && !storedVote && (
				<div className="mt-4 flex flex-wrap gap-2">
					<Button
						size="sm"
						variant="primary"
						disabled={isVoting}
						onClick={() => void handleCommit(true)}
					>
						Commit: release funds
					</Button>
					<Button
						size="sm"
						variant="secondary"
						disabled={isVoting}
						onClick={() => void handleCommit(false)}
					>
						Commit: uphold rejection
					</Button>
				</div>
			)}
			{dispute.phase === "active" && commitOpen && storedVote && (
				<p className="mt-3 text-xs text-emerald-300">
					Vote committed locally ({storedVote.vote ? "release" : "uphold"}).
					Reveal opens after the commit deadline.
				</p>
			)}
			{dispute.phase === "active" && revealOpen && (
				<div className="mt-4">
					<Button
						size="sm"
						variant="primary"
						disabled={isVoting}
						onClick={() => void handleReveal()}
					>
						Reveal vote
					</Button>
					{!storedVote && (
						<p className="mt-2 text-xs text-red-300">
							No locally stored vote -- reveal from the browser you committed
							in, or your vote cannot be revealed and your stake will be slashed
							for non-participation.
						</p>
					)}
				</div>
			)}
		</div>
	)
}

export default function Disputes() {
	const { address, signTransaction } = useWallet()
	const { milestoneArbitration } = useContractIds()
	const { showSuccess, showError, showInfo } = useToast()
	const [stakeAmount, setStakeAmount] = useState(MIN_JUROR_STAKE_LRN)
	const [isJoining, setIsJoining] = useState(false)

	const { data: openDisputes, isLoading: isLoadingOpen } = useDisputes({
		phase: "active",
	})
	const { data: assignments, isLoading: isLoadingAssignments } =
		useJurorAssignments(address ?? null)

	const handleJoinPanel = async () => {
		if (!address || !signTransaction) {
			showError("Connect your wallet first.")
			return
		}
		if (!milestoneArbitration) {
			showError("Arbitration contract is not configured.")
			return
		}
		const atomicAmount = String(Math.round(Number(stakeAmount) * 10_000_000))
		setIsJoining(true)
		try {
			showInfo("Waiting for wallet approval...")
			await submitJoinPanel({
				contractId: milestoneArbitration,
				jurorAddress: address,
				stakeAmount: atomicAmount,
				signTransaction,
			})
			showSuccess(`Staked ${stakeAmount} LRN and joined the juror pool.`)
		} catch (err) {
			showError(
				err instanceof Error ? err.message : "Failed to join the juror pool.",
			)
		} finally {
			setIsJoining(false)
		}
	}

	return (
		<div className="min-h-screen px-4 py-16 sm:px-6 md:px-8">
			<div className="mx-auto flex max-w-6xl flex-col gap-8">
				<section className="glass-card rounded-[2rem] border border-white/10 px-4 sm:px-6 py-6 sm:py-8 shadow-2xl">
					<p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.35em] text-brand-cyan/70">
						Milestone arbitration
					</p>
					<h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
						Juror console
					</h1>
					<p className="mt-3 max-w-3xl text-sm text-white/65 leading-relaxed">
						Stake LRN to join the eligible-juror pool. When a dispute draws you
						onto its panel, you have a commit window to submit a blind vote and
						a reveal window to disclose it -- miss either and your stake is
						slashed.
					</p>
				</section>

				<div className="grid gap-8 lg:grid-cols-[1fr,1.4fr]">
					<div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 sm:p-6 shadow-xl backdrop-blur-xl">
						<Card>
							<h2 className="text-lg sm:text-xl font-black text-white">
								Join the juror pool
							</h2>
							<p className="mt-2 text-xs sm:text-sm text-white/60">
								Minimum stake is {MIN_JUROR_STAKE_LRN} LRN. Your stake is
								slashed if you're drawn onto a panel and fail to reveal, or if
								you vote against the majority.
							</p>
							<label className="mt-4 block space-y-2 text-xs sm:text-sm text-white/80">
								<span className="font-semibold text-white">
									Stake amount (LRN)
								</span>
								<input
									value={stakeAmount}
									onChange={(e) => setStakeAmount(e.target.value)}
									inputMode="decimal"
									className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 min-h-[48px] text-white outline-none transition focus:border-brand-cyan/50"
								/>
							</label>
							<div className="mt-4">
								<Button
									variant="primary"
									size="md"
									isFullWidth
									disabled={!address || isJoining}
									onClick={() => void handleJoinPanel()}
								>
									{address
										? isJoining
											? "Staking..."
											: "Stake & join pool"
										: "Connect wallet"}
								</Button>
							</div>
						</Card>
					</div>

					<div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 sm:p-6 shadow-xl backdrop-blur-xl">
						<Card>
							<h2 className="text-lg sm:text-xl font-black text-white">
								Your assignments
							</h2>
							{!address ? (
								<p className="mt-4 text-sm text-white/60">
									Connect your wallet to see disputes you've been drawn to
									judge.
								</p>
							) : isLoadingAssignments ? (
								<p className="mt-4 text-sm text-white/60">Loading...</p>
							) : !assignments?.data.length ? (
								<p className="mt-4 text-sm text-white/60">
									No panel assignments yet.
								</p>
							) : (
								<div className="mt-4 space-y-3">
									{assignments.data.map((dispute) => (
										<DisputeCard key={dispute.dispute_id} dispute={dispute} />
									))}
								</div>
							)}
						</Card>
					</div>
				</div>

				<div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 sm:p-6 shadow-xl backdrop-blur-xl">
					<Card>
						<h2 className="text-lg sm:text-xl font-black text-white">
							Open disputes
						</h2>
						{isLoadingOpen ? (
							<p className="mt-4 text-sm text-white/60">Loading...</p>
						) : !openDisputes?.data.length ? (
							<p className="mt-4 text-sm text-white/60">
								No open disputes right now.
							</p>
						) : (
							<div className="mt-4 grid gap-3 sm:grid-cols-2">
								{openDisputes.data.map((dispute) => (
									<Link
										key={dispute.dispute_id}
										to={`/disputes/${dispute.dispute_id}`}
										className="rounded-2xl border border-white/10 p-4 hover:border-brand-cyan/40 transition-colors"
									>
										<p className="text-sm font-semibold text-white">
											Dispute #{dispute.dispute_id}
										</p>
										<p className="mt-1 text-xs text-white/60">
											Proposal #{dispute.proposal_id} · Milestone #
											{dispute.milestone_id}
										</p>
										<p className="mt-1 text-xs text-white/50">
											Reveal deadline {formatDeadline(dispute.reveal_deadline)}
										</p>
									</Link>
								))}
							</div>
						)}
					</Card>
				</div>
			</div>
		</div>
	)
}
