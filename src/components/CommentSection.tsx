import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import ReactMarkdown from "react-markdown"
import CommentCard from "./CommentCard"

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

interface CommentSectionProps {
	proposalId: string
	proposalAuthor?: string
}

const CommentSection: React.FC<CommentSectionProps> = ({
	proposalId,
	proposalAuthor,
}) => {
	const { t } = useTranslation()
	const [comments, setComments] = useState<Comment[]>([])
	const [newComment, setNewComment] = useState("")
	const [sortBy, setSortBy] = useState<"top" | "new" | "oldest">("new")
	const [loading, setLoading] = useState(true)

	const fetchComments = async () => {
		setLoading(true)
		try {
			const res = await fetch(
				`${import.meta.env.VITE_SERVER_URL}/api/proposals/${proposalId}/comments`,
			)
			const data = await res.json()
			setComments(data)
		} catch (err) {
			console.error("Failed to fetch comments", err)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		void fetchComments()
	}, [proposalId])

	const handlePostComment = async (parentId: number | null = null) => {
		if (!newComment.trim()) return

		const token = localStorage.getItem("auth_token") || "mock-token"

		try {
			const res = await fetch(
				`${import.meta.env.VITE_SERVER_URL}/api/comments`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						proposalId,
						content: newComment,
						parentId,
					}),
				},
			)

			if (res.ok) {
				setNewComment("")
				void fetchComments()
			} else {
				const err = await res.json()
				alert(err.error || "Failed to post comment")
			}
		} catch (err) {
			console.error("Error posting comment", err)
		}
	}

	const sortedComments = [...comments].sort((a, b) => {
		if (a.is_pinned && !b.is_pinned) return -1
		if (!a.is_pinned && b.is_pinned) return 1

		if (sortBy === "top")
			return b.upvotes - b.downvotes - (a.upvotes - a.downvotes)
		if (sortBy === "oldest")
			return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
		return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
	})

	const rootComments = sortedComments.filter((c) => !c.parent_id)
	const getReplies = (parentId: number) =>
		sortedComments.filter((c) => c.parent_id === parentId)

	return (
		<div className="mt-16 border-t border-white/5 pt-16">
			<div className="flex items-center justify-between mb-8">
				<h3 className="text-2xl font-black tracking-tight">
					{t("comments.title", "Discussion")}
				</h3>
				<div className="flex gap-4">
					{(["top", "new", "oldest"] as const).map((sort) => (
						<button
							key={sort}
							onClick={() => setSortBy(sort)}
							className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all ${
								sortBy === sort
									? "bg-brand-cyan text-black"
									: "bg-white/5 text-white/40 hover:bg-white/10"
							}`}
						>
							{sort}
						</button>
					))}
				</div>
			</div>

			<div className="mb-12">
				<textarea
					value={newComment}
					onChange={(e) => setNewComment(e.target.value)}
					placeholder={t(
						"comments.placeholder",
						"Share your thoughts... (Markdown supported)",
					)}
					className="w-full h-32 bg-[#0a0c10] border border-white/10 rounded-[2rem] p-6 text-white placeholder-white/20 focus:outline-none focus:border-brand-cyan/50 transition-colors"
				/>
				<div className="flex justify-end mt-4">
					<button
						onClick={() => handlePostComment()}
						disabled={!newComment.trim()}
						className="px-8 py-3 bg-brand-cyan text-black font-black uppercase tracking-widest rounded-full hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100"
					>
						Post Comment
					</button>
				</div>
			</div>

			{loading ? (
				<div className="text-center py-20 text-white/20 uppercase font-black tracking-widest animate-pulse">
					Loading Discussion...
				</div>
			) : (
				<div className="space-y-8">
					{rootComments.map((comment) => (
						<div key={comment.id}>
							<CommentCard
								comment={comment}
								isAuthor={comment.author_address === proposalAuthor}
								canPin={proposalAuthor === "CURRENT_USER_ADDRESS"} // Logic for pinning
								onUpdate={fetchComments}
							/>
							<div className="ml-12 mt-6 space-y-6 border-l border-white/5 pl-8">
								{getReplies(comment.id).map((reply) => (
									<CommentCard
										key={reply.id}
										comment={reply}
										isReply
										onUpdate={fetchComments}
									/>
								))}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

export default CommentSection
