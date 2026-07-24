import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import {
	ArrowLeft,
	Clock,
	Coins,
	Tag,
	User,
	GitPullRequest,
	ExternalLink,
	CheckCircle,
	Loader2,
	AlertTriangle,
} from "lucide-react"
import { useBounty, useClaimBounty, useSubmitWork, useApproveBounty, useCancelBounty } from "../hooks/useBounties"
import { useWallet } from "../hooks/useWallet"
import { useToast } from "../components/Toast/ToastProvider"
import type { BountyStatus } from "../types/bounty"

function statusColor(status: BountyStatus): string {
	switch (status) {
		case "open": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
		case "claimed": return "bg-amber-500/20 text-amber-400 border-amber-500/30"
		case "submitted": return "bg-blue-500/20 text-blue-400 border-blue-500/30"
		case "approved":
		case "paid": return "bg-brand-purple/20 text-brand-purple border-brand-purple/30"
		case "cancelled": return "bg-white/10 text-white/40 border-white/10"
		default: return "bg-white/10 text-white/50 border-white/10"
	}
}

function formatDeadline(deadline: string | null): string {
	if (!deadline) return "No deadline"
	const d = new Date(deadline)
	const now = Date.now()
	const diff = d.getTime() - now
	if (diff <= 0) return "Expired"
	const hours = Math.floor(diff / (1000 * 60 * 60))
	const days = Math.floor(hours / 24)
	const remHours = hours % 24
	if (days > 0) return `${days}d ${remHours}h remaining`
	return `${hours}h remaining`
}

function shortenAddr(addr: string): string {
	if (!addr || addr.length <= 10) return addr
	return `${addr.slice(0, 4)}...${addr.slice(-4)}`
}

export default function BountyDetail() {
	const { id } = useParams<{ id: string }>()
	const bountyId = Number(id)
	const { address } = useWallet()
	const { showSuccess, showError } = useToast()
	const { data, isLoading, error } = useBounty(bountyId)
	const claimMutation = useClaimBounty()
	const submitMutation = useSubmitWork(bountyId)
	const approveMutation = useApproveBounty()
	const cancelMutation = useCancelBounty()

	const [repoUrl, setRepoUrl] = useState("")
	const [notes, setNotes] = useState("")
	const [confirmApprove, setConfirmApprove] = useState(false)

	const bounty = data?.bounty
	const submission = data?.submission

	const isSponsor = address && bounty?.sponsor_addr?.toLowerCase() === address.toLowerCase()
	const isClaimant = address && bounty?.claimed_by?.toLowerCase() === address.toLowerCase()
	const canClaim = bounty?.status === "open" && address && !isSponsor
	const canSubmit = bounty?.status === "claimed" && isClaimant && bounty.deadline && new Date(bounty.deadline) > new Date()
	const canApprove = bounty?.status === "submitted" && isSponsor

	const handleClaim = async () => {
		try {
			await claimMutation.mutateAsync(bountyId)
			showSuccess("Bounty claimed successfully!")
		} catch (err) {
			showError(err instanceof Error ? err.message : "Failed to claim bounty")
		}
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		try {
			await submitMutation.mutateAsync({ repoUrl: repoUrl.trim() || undefined, notes: notes.trim() || undefined })
			showSuccess("Work submitted!")
			setRepoUrl("")
			setNotes("")
		} catch (err) {
			showError(err instanceof Error ? err.message : "Failed to submit work")
		}
	}

	const handleApprove = async () => {
		try {
			const result = await approveMutation.mutateAsync(bountyId)
			showSuccess("Submission approved! Payout and LRN reward processed.")
			setConfirmApprove(false)
		} catch (err) {
			showError(err instanceof Error ? err.message : "Failed to approve")
		}
	}

	const handleCancel = async () => {
		try {
			await cancelMutation.mutateAsync(bountyId)
			showSuccess("Bounty cancelled")
		} catch (err) {
			showError(err instanceof Error ? err.message : "Failed to cancel")
		}
	}

	if (isLoading) {
		return (
			<div className="mx-auto max-w-4xl px-6 py-12 sm:px-12">
				<div className="glass-card rounded-[2.5rem] border border-white/5 p-8 animate-pulse">
					<div className="h-8 w-64 rounded-full bg-white/8 mb-4" />
					<div className="h-4 w-96 rounded-full bg-white/6 mb-8" />
					<div className="h-32 rounded-2xl bg-white/5" />
				</div>
			</div>
		)
	}

	if (error || !bounty) {
		return (
			<div className="mx-auto max-w-4xl px-6 py-12 sm:px-12">
				<div className="glass-card rounded-[2.5rem] border border-white/5 p-8 text-center">
					<AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
					<p className="text-white/70">Bounty not found or failed to load.</p>
					<Link to="/bounties" className="mt-4 inline-block text-brand-cyan text-sm hover:underline">
						Back to bounties
					</Link>
				</div>
			</div>
		)
	}

	return (
		<div className="mx-auto max-w-4xl px-6 py-12 sm:px-12">
			<Link
				to="/bounties"
				className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-6"
			>
				<ArrowLeft className="h-4 w-4" />
				Back to bounties
			</Link>

			{/* Header */}
			<div className="glass-card rounded-[2.5rem] border border-white/5 p-8 mb-6">
				<div className="flex items-start justify-between gap-4 mb-4">
					<h1 className="text-2xl font-black text-white leading-tight">{bounty.title}</h1>
					<span className={`shrink-0 inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${statusColor(bounty.status)}`}>
						{bounty.status}
					</span>
				</div>
				<p className="text-white/60 leading-relaxed whitespace-pre-wrap mb-6">{bounty.description}</p>

				<div className="flex flex-wrap gap-2 mb-6">
					{bounty.skill_tags?.map((tag) => (
						<span
							key={tag}
							className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-medium text-white/60"
						>
							<Tag className="h-3 w-3" />
							{tag}
						</span>
					))}
				</div>

				<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
					<div>
						<div className="text-white/40 text-xs uppercase tracking-wider mb-1">Reward</div>
						<div className="flex items-center gap-1 font-bold text-brand-emerald">
							<Coins className="h-4 w-4" />
							{bounty.reward_usdc} USDC
						</div>
					</div>
					<div>
						<div className="text-white/40 text-xs uppercase tracking-wider mb-1">Sponsor</div>
						<div className="flex items-center gap-1 font-medium text-white/70">
							<User className="h-3.5 w-3.5" />
							{shortenAddr(bounty.sponsor_addr)}
						</div>
					</div>
					<div>
						<div className="text-white/40 text-xs uppercase tracking-wider mb-1">Deadline</div>
						<div className="flex items-center gap-1 font-medium text-white/70">
							<Clock className="h-3.5 w-3.5" />
							{formatDeadline(bounty.deadline)}
						</div>
					</div>
					<div>
						<div className="text-white/40 text-xs uppercase tracking-wider mb-1">Created</div>
						<div className="font-medium text-white/70">
							{new Date(bounty.created_at).toLocaleDateString()}
						</div>
					</div>
				</div>
			</div>

			{/* Sponsor actions */}
			{isSponsor && bounty.status !== "cancelled" && bounty.status !== "paid" && (
				<div className="glass-card rounded-[2rem] border border-white/5 p-6 mb-6">
					<h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Sponsor Actions</h3>
					<div className="flex flex-wrap gap-3">
						{canApprove && (
							<>
								{!confirmApprove ? (
									<button
										onClick={() => setConfirmApprove(true)}
										className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-emerald text-black font-bold rounded-xl text-sm hover:scale-105 active:scale-95 transition-all"
									>
										<CheckCircle className="h-4 w-4" />
										Approve & Pay
									</button>
								) : (
									<div className="flex items-center gap-2">
										<button
											onClick={handleApprove}
											disabled={approveMutation.isPending}
											className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white font-bold rounded-xl text-sm hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
										>
											{approveMutation.isPending ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												<AlertTriangle className="h-4 w-4" />
											)}
											Confirm Pay
										</button>
										<button
											onClick={() => setConfirmApprove(false)}
											className="px-4 py-2.5 glass rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-all"
										>
											Cancel
										</button>
									</div>
								)}
							</>
						)}
						{(bounty.status === "open" || bounty.status === "claimed") && (
							<button
								onClick={handleCancel}
								disabled={cancelMutation.isPending}
								className="inline-flex items-center gap-2 px-4 py-2.5 glass rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-all"
							>
								Cancel Bounty
							</button>
						)}
					</div>
					{canApprove && (
						<p className="text-xs text-amber-400/70 mt-2">
							Approving will release escrowed USDC to the learner and mint LRN rewards.
						</p>
					)}
				</div>
			)}

			{/* Claimant / submission info */}
			{(bounty.status === "claimed" || bounty.status === "submitted" || bounty.status === "paid") && (
				<div className="glass-card rounded-[2rem] border border-white/5 p-6 mb-6">
					<h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
						{bounty.status === "submitted" ? "Submission" : bounty.status === "paid" ? "Completed" : "Claimed By"}
					</h3>
					<div className="flex items-center gap-2 text-sm text-white/60">
						<User className="h-4 w-4" />
						{shortenAddr(bounty.claimed_by ?? "")}
					</div>
					{bounty.deadline && (
						<div className="flex items-center gap-2 text-xs text-white/40 mt-2">
							<Clock className="h-3 w-3" />
							{formatDeadline(bounty.deadline)}
						</div>
					)}
				</div>
			)}

			{/* Submission details */}
			{submission && (bounty.status === "submitted" || bounty.status === "paid") && (
				<div className="glass-card rounded-[2rem] border border-white/5 p-6 mb-6">
					<h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Submitted Work</h3>
					{submission.repo_url && (
						<a
							href={submission.repo_url}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1.5 text-sm text-brand-cyan hover:underline mb-2"
						>
							<GitPullRequest className="h-4 w-4" />
							{submission.repo_url}
							<ExternalLink className="h-3 w-3" />
						</a>
					)}
					{submission.notes && (
						<p className="text-sm text-white/60 mt-2 whitespace-pre-wrap">{submission.notes}</p>
					)}
					<p className="text-xs text-white/30 mt-3">
						Submitted {new Date(submission.submitted_at).toLocaleString()}
					</p>
					{bounty.payout_tx && (
						<p className="text-xs text-emerald-400/70 mt-2">
							Payout TX: {bounty.payout_tx}
						</p>
					)}
					{bounty.reward_tx && (
						<p className="text-xs text-brand-purple/70 mt-1">
							LRN TX: {bounty.reward_tx}
						</p>
					)}
				</div>
			)}

			{/* Learner claim / submit actions */}
			{canClaim && (
				<div className="glass-card rounded-[2rem] border border-white/5 p-6 mb-6">
					<h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Claim This Bounty</h3>
					<p className="text-xs text-white/40 mb-4">
						Claiming reserves this bounty for you. You will have 72 hours to submit your work.
					</p>
					<button
						onClick={handleClaim}
						disabled={claimMutation.isPending}
						className="inline-flex items-center gap-2 px-6 py-3 bg-brand-cyan text-black font-bold rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50 text-sm"
					>
						{claimMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
						Claim Bounty
					</button>
				</div>
			)}

			{canSubmit && (
				<div className="glass-card rounded-[2rem] border border-white/5 p-6 mb-6">
					<h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Submit Your Work</h3>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label className="block text-xs text-white/50 mb-1.5">Repository / PR URL</label>
							<input
								type="url"
								value={repoUrl}
								onChange={(e) => setRepoUrl(e.target.value)}
								placeholder="https://github.com/..."
								className="w-full px-4 py-2.5 glass rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-cyan/50 transition-colors"
							/>
						</div>
						<div>
							<label className="block text-xs text-white/50 mb-1.5">Notes</label>
							<textarea
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								placeholder="Describe your implementation..."
								rows={4}
								className="w-full px-4 py-2.5 glass rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-cyan/50 transition-colors resize-none"
							/>
						</div>
						<button
							type="submit"
							disabled={submitMutation.isPending || (!repoUrl.trim() && !notes.trim())}
							className="inline-flex items-center gap-2 px-6 py-3 bg-brand-cyan text-black font-bold rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50 text-sm"
						>
							{submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitPullRequest className="h-4 w-4" />}
							Submit Work
						</button>
					</form>
				</div>
			)}

			{/* Post-approval status */}
			{bounty.status === "paid" && (
				<div className="glass-card rounded-[2rem] border border-emerald-500/20 p-6">
					<div className="flex items-center gap-3">
						<CheckCircle className="h-8 w-8 text-emerald-400" />
						<div>
							<h3 className="text-base font-bold text-white">Bounty Completed</h3>
							<p className="text-sm text-white/50">
								USDC and LRN rewards have been distributed to the learner.
							</p>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
