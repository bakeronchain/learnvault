import { formatDistanceToNow } from "date-fns"
import React, { useId, useState } from "react"
import ReactMarkdown from "react-markdown"
import { getAuthToken } from "../util/auth"

export interface Comment {
	id: number
	proposal_id: string
	author_address: string
	parent_id: number | null
	content: string
	upvotes: number
	downvotes: number
	is_pinned: boolean
	created_at: string
	flag_count?: number
	hidden_at?: string | null
}

interface CommentCardProps {
	comment: Comment
	isAuthor?: boolean
	isReply?: boolean
	canPin?: boolean
	currentUserAddress?: string
	onUpdate?: () => void
}

const API_URL = (
	(import.meta.env.VITE_API_URL as string | undefined) ??
	(import.meta.env.VITE_SERVER_URL as string | undefined) ??
	""
).replace(/\/$/, "")

const FLAG_REASONS = [
	"Spam or self-promotion",
	"Harassment or hate speech",
	"Misinformation",
	"Off-topic",
	"Other",
] as const

const shortenAddress = (address: string) => {
	if (!address) return ""
	return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const CommentCard: React.FC<CommentCardProps> = ({
	comment,
	isAuthor,
	isReply,
	canPin,
	currentUserAddress,
	onUpdate,
}) => {
	const [isReplying, setIsReplying] = useState(false)
	const [replyText, setReplyText] = useState("")
	const [replyError, setReplyError] = useState<string | null>(null)

	// Flag state
	const [isFlagOpen, setIsFlagOpen] = useState(false)
	const [flagReason, setFlagReason] = useState<string>(FLAG_REASONS[0])
	const [flagCustomReason, setFlagCustomReason] = useState("")
	const [flagSubmitting, setFlagSubmitting] = useState(false)
	const [flagError, setFlagError] = useState<string | null>(null)
	const [flagSuccess, setFlagSuccess] = useState(false)

	const replyFieldId = useId()
	const replyHintId = `${replyFieldId}-hint`
	const replyErrorId = `${replyFieldId}-error`
	const replySectionId = `${replyFieldId}-section`
	const flagDialogId = `${replyFieldId}-flag-dialog`
	const flagReasonId = `${replyFieldId}-flag-reason`
	const authorId = `comment-${comment.id}-author`

	const isOwnComment =
		currentUserAddress &&
		comment.author_address.toLowerCase() === currentUserAddress.toLowerCase()

	const handleVote = async (type: "upvote" | "downvote") => {
		const token = getAuthToken()
		if (!token) return
		try {
			const res = await fetch(`${API_URL}/api/comments/${comment.id}/vote`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ type }),
			})
			if (res.ok) onUpdate?.()
		} catch (err) {
			console.error("Vote failed", err)
		}
	}

	const handlePin = async () => {
		const token = getAuthToken()
		if (!token) return
		try {
			const res = await fetch(`${API_URL}/api/comments/${comment.id}/pin`, {
				method: "PUT",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})
			if (res.ok) onUpdate?.()
		} catch (err) {
			console.error("Pin failed", err)
		}
	}

	const handlePostReply = async () => {
		if (!replyText.trim()) {
			setReplyError("Enter a reply before submitting.")
			return
		}

		const token = getAuthToken()
		if (!token) {
			setReplyError("Sign in to reply.")
			return
		}
		setReplyError(null)

		try {
			const res = await fetch(`${API_URL}/api/comments`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					proposalId: comment.proposal_id,
					content: replyText,
					parentId: comment.id,
				}),
			})
			if (res.ok) {
				setReplyText("")
				setIsReplying(false)
				onUpdate?.()
			} else {
				const err = await res.json().catch(() => ({}))
				setReplyError((err as { error?: string }).error || "Reply failed.")
			}
		} catch (err) {
			console.error("Reply failed", err)
			setReplyError("Reply failed.")
		}
	}

	const handleSubmitFlag = async () => {
		const token = getAuthToken()
		if (!token) {
			setFlagError("Sign in to flag content.")
			return
		}

		const reason =
			flagReason === "Other" ? flagCustomReason.trim() : flagReason
		if (!reason) {
			setFlagError("Please provide a reason.")
			return
		}

		setFlagSubmitting(true)
		setFlagError(null)

		try {
			const res = await fetch(`${API_URL}/api/comments/${comment.id}/flag`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ reason }),
			})

			if (res.ok) {
				setFlagSuccess(true)
				setTimeout(() => {
					setIsFlagOpen(false)
					setFlagSuccess(false)
					setFlagReason(FLAG_REASONS[0])
					setFlagCustomReason("")
				}, 1500)
			} else {
				const data = await res.json().catch(() => ({}))
				setFlagError(
					(data as { error?: string }).error || "Failed to submit flag.",
				)
			}
		} catch {
			setFlagError("Failed to submit flag.")
		} finally {
			setFlagSubmitting(false)
		}
	}

	const toggleReply = () => {
		setIsReplying((current) => !current)
		setReplyError(null)
	}

	const replyDescriptionIds = [
		replyHintId,
		replyError ? replyErrorId : undefined,
	]
		.filter(Boolean)
		.join(" ")

	return (
		<article
			className={`glass-card p-6 rounded-3xl border border-white/5 relative ${comment.is_pinned ? "border-brand-cyan/30 bg-brand-cyan/5" : ""}`}
			aria-labelledby={authorId}
		>
			{comment.is_pinned && (
				<div className="absolute -top-3 left-6 px-3 py-1 bg-brand-cyan text-black text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1 shadow-xl">
					Pinned by Author
				</div>
			)}

			<header className="flex justify-between items-start mb-6">
				<div className="flex items-center gap-4">
					<div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-xs font-black text-white/70 border border-white/10 transition-colors">
						{comment.author_address.slice(0, 2)}
					</div>
					<div>
						<div className="flex items-center gap-2">
							<span id={authorId} className="text-sm font-black text-white">
								{shortenAddress(comment.author_address)}
							</span>
							{isAuthor && (
								<span className="px-2 py-0.5 bg-brand-purple/20 text-brand-purple text-[8px] font-black uppercase tracking-widest rounded-sm border border-brand-purple/20">
									Author
								</span>
							)}
						</div>
						<p className="text-[10px] text-white/50 uppercase font-bold tracking-widest mt-1">
							{formatDistanceToNow(new Date(comment.created_at))} ago
						</p>
					</div>
				</div>

				<div className="flex gap-2 items-center">
					{canPin && !comment.is_pinned && (
						<button
							type="button"
							onClick={() => void handlePin()}
							className="text-[10px] font-black uppercase text-white/70 hover:text-brand-cyan transition-colors"
						>
							Pin
						</button>
					)}
					{!isReply && (
						<button
							type="button"
							onClick={toggleReply}
							aria-expanded={isReplying}
							aria-controls={replySectionId}
							className="text-[10px] font-black uppercase text-white/70 hover:text-brand-cyan transition-colors"
						>
							Reply
						</button>
					)}
					{/* Flag button — hidden for own comments */}
					{!isOwnComment && (
						<button
							type="button"
							onClick={() => {
								setIsFlagOpen(true)
								setFlagError(null)
								setFlagSuccess(false)
							}}
							aria-haspopup="dialog"
							aria-label={`Flag comment from ${shortenAddress(comment.author_address)}`}
							className="text-[10px] font-black uppercase text-white/30 hover:text-red-400 transition-colors"
							title="Flag this comment"
						>
							⚑ Flag
						</button>
					)}
				</div>
			</header>

			<div className="prose prose-invert prose-sm max-w-none text-white/80 leading-relaxed font-medium mb-8">
				<ReactMarkdown>{comment.content}</ReactMarkdown>
			</div>

			<footer className="flex items-center gap-6">
				<div className="flex items-center bg-white/5 rounded-full p-1 border border-white/5">
					<button
						type="button"
						onClick={() => void handleVote("upvote")}
						className="w-8 h-8 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
						aria-label={`Upvote comment from ${shortenAddress(comment.author_address)}`}
					>
						👍
					</button>
					<span className="text-xs font-black text-white px-2 leading-none">
						{comment.upvotes - comment.downvotes}
					</span>
					<button
						type="button"
						onClick={() => void handleVote("downvote")}
						className="w-8 h-8 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
						aria-label={`Downvote comment from ${shortenAddress(comment.author_address)}`}
					>
						👎
					</button>
				</div>
			</footer>

			{isReplying && (
				<div
					id={replySectionId}
					className="mt-8 pt-8 border-t border-white/5 animate-in slide-in-from-top-4 duration-500"
				>
					<label
						htmlFor={replyFieldId}
						className="block text-sm font-bold text-white mb-3"
					>
						Reply
					</label>
					<p id={replyHintId} className="mb-3 text-sm text-white/70">
						Markdown is supported.
					</p>
					<textarea
						id={replyFieldId}
						value={replyText}
						onChange={(event) => {
							setReplyText(event.target.value)
							if (replyError) {
								setReplyError(null)
							}
						}}
						placeholder="Write your reply..."
						className="w-full h-24 bg-black/40 border border-white/10 rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-brand-cyan/40"
						aria-invalid={Boolean(replyError)}
						aria-describedby={replyDescriptionIds || undefined}
					/>
					{replyError && (
						<p
							id={replyErrorId}
							className="mt-3 text-sm text-red-400"
							role="alert"
						>
							{replyError}
						</p>
					)}
					<div className="flex justify-end gap-3 mt-4">
						<button
							type="button"
							onClick={() => {
								setIsReplying(false)
								setReplyText("")
								setReplyError(null)
							}}
							className="px-5 py-2 text-[10px] font-black uppercase text-white/70 border border-white/10 rounded-full hover:bg-white/5 transition-colors"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={() => void handlePostReply()}
							disabled={!replyText.trim()}
							className="px-5 py-2 bg-brand-cyan text-black text-[10px] font-black uppercase tracking-widest rounded-full hover:scale-105 transition-all disabled:opacity-50"
						>
							Submit Reply
						</button>
					</div>
				</div>
			)}

			{/* Flag dialog */}
			{isFlagOpen && (
				<div
					role="dialog"
					id={flagDialogId}
					aria-modal="true"
					aria-labelledby={`${flagDialogId}-title`}
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
				>
					<div className="glass border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
						<h2
							id={`${flagDialogId}-title`}
							className="text-base font-semibold text-white mb-1"
						>
							Flag Comment
						</h2>
						<p className="text-xs text-white/50 mb-4">
							Help us keep the community safe. Select a reason below.
						</p>

						{flagSuccess ? (
							<p className="text-sm text-emerald-400 text-center py-4">
								✓ Flag submitted. Thank you.
							</p>
						) : (
							<>
								<label
									htmlFor={flagReasonId}
									className="block text-xs text-white/60 uppercase tracking-widest mb-2"
								>
									Reason
								</label>
								<select
									id={flagReasonId}
									value={flagReason}
									onChange={(e) => setFlagReason(e.target.value)}
									className="w-full glass border border-white/10 text-white/80 text-sm rounded-xl px-3 py-2 bg-transparent focus:outline-none focus:border-white/20 mb-3"
								>
									{FLAG_REASONS.map((r) => (
										<option key={r} value={r} className="bg-gray-900">
											{r}
										</option>
									))}
								</select>

								{flagReason === "Other" && (
									<textarea
										value={flagCustomReason}
										onChange={(e) => setFlagCustomReason(e.target.value)}
										placeholder="Describe the issue..."
										maxLength={500}
										className="w-full h-20 bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-brand-cyan/40 mb-3"
									/>
								)}

								{flagError && (
									<p className="text-xs text-red-400 mb-3" role="alert">
										{flagError}
									</p>
								)}

								<div className="flex gap-3 justify-end">
									<button
										type="button"
										onClick={() => setIsFlagOpen(false)}
										className="px-4 py-2 text-xs rounded-xl border border-white/10 text-white/60 hover:text-white transition-colors"
									>
										Cancel
									</button>
									<button
										type="button"
										onClick={() => void handleSubmitFlag()}
										disabled={
											flagSubmitting ||
											(flagReason === "Other" && !flagCustomReason.trim())
										}
										className="px-4 py-2 text-xs rounded-xl font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
									>
										{flagSubmitting ? "Submitting…" : "Submit Flag"}
									</button>
								</div>
							</>
						)}
					</div>
				</div>
			)}
		</article>
	)
}

export default CommentCard
