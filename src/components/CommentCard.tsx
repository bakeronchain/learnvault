import { formatDistanceToNow } from "date-fns"
import React, { useId, useState } from "react"
import ReactMarkdown from "react-markdown"
import ConfirmDialog from "./ConfirmDialog"
import { useWallet } from "../hooks/useWallet"
import { getAuthToken } from "../util/auth"
import AddressDisplay from "./AddressDisplay"

const API_BASE = import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000"

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
}

interface CommentCardProps {
	comment: Comment
	isAuthor?: boolean
	isReply?: boolean
	canPin?: boolean
	canDelete?: boolean
	onUpdate?: () => void
}

const API_URL = (
	(import.meta.env.VITE_API_URL as string | undefined) ??
	(import.meta.env.VITE_SERVER_URL as string | undefined) ??
	""
).replace(/\/$/, "")




const CommentCard: React.FC<CommentCardProps> = ({
	comment,
	isAuthor,
	isReply,
	canPin,
	canDelete,
	onUpdate,
}) => {
	const { address } = useWallet()
	const [isReplying, setIsReplying] = useState(false)
	const [replyText, setReplyText] = useState("")
	const [replyError, setReplyError] = useState<string | null>(null)
	const [isFlagging, setIsFlagging] = useState(false)
	const [flagReason, setFlagReason] = useState("")
	const [flagError, setFlagError] = useState<string | null>(null)
	const [isEditing, setIsEditing] = useState(false)
	const [editText, setEditText] = useState(comment.content)
	const [editError, setEditError] = useState<string | null>(null)
	const replyFieldId = useId()
	const replyHintId = `${replyFieldId}-hint`
	const replyErrorId = `${replyFieldId}-error`
	const replySectionId = `${replyFieldId}-section`
	const authorId = `comment-${comment.id}-author`

	const isOwnComment =
		!!address &&
		comment.author_address.toLowerCase() === address.toLowerCase()

	const handleSaveEdit = async () => {
		if (!editText.trim()) {
			setEditError("Comment cannot be empty.")
			return
		}
		const token = getAuthToken()
		if (!token) {
			setEditError("Sign in to edit a comment.")
			return
		}
		setEditError(null)
		try {
			const res = await fetch(`${API_URL}/api/comments/${comment.id}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ content: editText }),
			})
			if (res.ok) {
				setIsEditing(false)
				onUpdate?.()
			} else {
				const err = await res.json().catch(() => ({}))
				setEditError(err.error || "Failed to update comment.")
			}
		} catch (err) {
			console.error("Edit failed", err)
			setEditError("Failed to update comment.")
		}
	}

	const handleDelete = async () => {
		if (!window.confirm("Delete this comment? This cannot be undone.")) {
			return
		}
		const token = getAuthToken()
		if (!token) return
		try {
			const res = await fetch(`${API_URL}/api/comments/${comment.id}`, {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})
			if (res.ok) onUpdate?.()
		} catch (err) {
			console.error("Delete failed", err)
		}
	}

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

	const handleFlag = async () => {
		if (!flagReason.trim()) {
			setFlagError("Please provide a reason for reporting this comment.")
			return
		}

		if (flagReason.length < 10) {
			setFlagError("Reason must be at least 10 characters.")
			return
		}

		const token = getAuthToken()
		if (!token) {
			setFlagError("Sign in to report content.")
			return
		}

		setFlagError(null)
		try {
			const res = await fetch(`${API_URL}/api/content/flag`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					contentType: "comment",
					contentId: comment.id,
					reason: flagReason,
				}),
			})

			if (res.ok) {
				setIsFlagging(false)
				setFlagReason("")
				// Show success message
			} else {
				const err = await res.json().catch(() => ({}))
				setFlagError(err.error || "Failed to report comment.")
			}
		} catch (err) {
			console.error("Flag failed", err)
			setFlagError("Failed to report comment.")
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
				setReplyError(err.error || "Reply failed.")
			}
		} catch (err) {
			console.error("Reply failed", err)
			setReplyError("Reply failed.")
		}
	}

	const toggleReply = () => {
		setIsReplying((current) => !current)
		setReplyError(null)
	}

	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

	const handleDelete = async () => {
		const token = getAuthToken()
		if (!token) return
		try {
			const res = await fetch(`${API_URL}/api/comments/${comment.id}`, {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})
			if (res.ok) {
				onUpdate?.()
			}
		} catch (err) {
			console.error("Delete failed", err)
		} finally {
			setShowDeleteConfirm(false)
		}
	}

	const replyDescriptionIds = [
		replyHintId,
		replyError ? replyErrorId : undefined,
	]
		.filter(Boolean)
		.join(" ")

	return (
		<article
			data-testid={`comment-card-${comment.id}`}
			className={`glass-card p-6 rounded-3xl border border-white/5 relative ${comment.is_pinned ? "border-brand-cyan/30 bg-brand-cyan/5" : ""}`}
			aria-labelledby={authorId}
		>
			{showDeleteConfirm && (
				<ConfirmDialog
					title="Delete Comment"
					description="Are you sure you want to delete this comment? This action is permanent and cannot be undone."
					confirmLabel="Delete"
					cancelLabel="Keep Comment"
					onConfirm={() => void handleDelete()}
					onCancel={() => setShowDeleteConfirm(false)}
					isDestructive
				/>
			)}
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
							<AddressDisplay 
								address={comment.author_address} 
								addressClassName="text-sm font-black text-white"
								showCopyButton={false}
							/>
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

				<div className="flex gap-2">
					{isOwnComment && (
						<>
							<button
								type="button"
								data-testid="comment-edit"
								onClick={() => {
									setIsEditing((v) => !v)
									setEditText(comment.content)
									setEditError(null)
								}}
								className="text-[10px] font-black uppercase text-white/70 hover:text-brand-cyan transition-colors"
							>
								{isEditing ? "Close" : "Edit"}
							</button>
							<button
								type="button"
								data-testid="comment-delete"
								onClick={() => void handleDelete()}
								className="text-[10px] font-black uppercase text-white/70 hover:text-red-400 transition-colors"
							>
								Delete
							</button>
						</>
					)}
					{canPin && !comment.is_pinned && (
						<button
							type="button"
							onClick={() => void handlePin()}
							className="text-[10px] font-black uppercase text-white/70 hover:text-brand-cyan transition-colors"
						>
							Pin
						</button>
					)}
					{canDelete && (
						<button
							type="button"
							onClick={() => setShowDeleteConfirm(true)}
							className="text-[10px] font-black uppercase text-red-400/70 hover:text-red-400 transition-colors"
						>
							Delete
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
					<button
						type="button"
						onClick={() => setIsFlagging(!isFlagging)}
						className="text-[10px] font-black uppercase text-white/70 hover:text-red-400 transition-colors"
					>
						Flag
					</button>
				</div>
			</header>

			{isEditing ? (
				<div className="mb-8">
					<textarea
						value={editText}
						onChange={(e) => {
							setEditText(e.target.value)
							if (editError) setEditError(null)
						}}
						data-testid="comment-edit-field"
						className="w-full h-32 bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-brand-cyan/40"
					/>
					{editError && (
						<p className="mt-2 text-sm text-red-400" role="alert">
							{editError}
						</p>
					)}
					<div className="flex justify-end gap-3 mt-4">
						<button
							type="button"
							onClick={() => {
								setIsEditing(false)
								setEditText(comment.content)
								setEditError(null)
							}}
							className="px-5 py-2 text-[10px] font-black uppercase text-white/70 border border-white/10 rounded-full hover:bg-white/5 transition-colors"
						>
							Cancel
						</button>
						<button
							type="button"
							data-testid="comment-save-edit"
							onClick={() => void handleSaveEdit()}
							disabled={!editText.trim()}
							className="px-5 py-2 bg-brand-cyan text-black text-[10px] font-black uppercase tracking-widest rounded-full hover:scale-105 transition-all disabled:opacity-50"
						>
							Save
						</button>
					</div>
				</div>
			) : (
				<div className="prose prose-invert prose-sm max-w-none text-white/80 leading-relaxed font-medium mb-8">
					<ReactMarkdown>{comment.content}</ReactMarkdown>
				</div>
			)}

			<footer className="flex items-center gap-6">
				<div className="flex items-center bg-white/5 rounded-full p-1 border border-white/5">
					<button
						type="button"
						onClick={() => void handleVote("upvote")}
						className="w-8 h-8 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
						aria-label="Upvote comment"
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
						aria-label="Downvote comment"
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

			{isFlagging && (
				<div className="mt-8 pt-8 border-t border-white/5 animate-in slide-in-from-top-4 duration-500">
					<label
						htmlFor={`flag-reason-${comment.id}`}
						className="block text-sm font-bold text-white mb-3"
					>
						Report Comment
					</label>
					<p className="mb-3 text-sm text-white/70">
						Please describe why you're reporting this comment (minimum 10 characters).
					</p>
					<textarea
						id={`flag-reason-${comment.id}`}
						value={flagReason}
						onChange={(event) => {
							setFlagReason(event.target.value)
							if (flagError) {
								setFlagError(null)
							}
						}}
						placeholder="Explain why you're reporting this comment..."
						className="w-full h-24 bg-black/40 border border-white/10 rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-red-500/40"
						aria-invalid={Boolean(flagError)}
					/>
					{flagError && (
						<p className="mt-3 text-sm text-red-400" role="alert">
							{flagError}
						</p>
					)}
					<div className="flex justify-end gap-3 mt-4">
						<button
							type="button"
							onClick={() => {
								setIsFlagging(false)
								setFlagReason("")
								setFlagError(null)
							}}
							className="px-5 py-2 text-[10px] font-black uppercase text-white/70 border border-white/10 rounded-full hover:bg-white/5 transition-colors"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={() => void handleFlag()}
							disabled={!flagReason.trim()}
							className="px-5 py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:scale-105 transition-all disabled:opacity-50"
						>
							Submit Report
						</button>
					</div>
				</div>
			)}
		</article>
	)
}

export default CommentCard
