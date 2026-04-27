import { Button } from "@stellar/design-system"
import { useQueryClient } from "@tanstack/react-query"
import React, { useState } from "react"
import ReactMarkdown from "react-markdown"
import { useTranslation } from "react-i18next"
import { createThread, deleteThread, useForumThreads } from "../../hooks/useForum"
import { WalletAddressPill } from "../WalletAddressPill"

interface ThreadListProps {
	courseId: string
	onSelectThread: (id: number) => void
	currentAddress: string | null
	isAdmin: boolean
}

export const ThreadList: React.FC<ThreadListProps> = ({
	courseId, onSelectThread, currentAddress, isAdmin,
}) => {
	const { t } = useTranslation()
	const { data: threads, isLoading, error } = useForumThreads(courseId)
	const [isComposing, setIsComposing] = useState(false)
	const queryClient = useQueryClient()
	const [title, setTitle] = useState("")
	const [content, setContent] = useState("")
	const [isSubmitting, setIsSubmitting] = useState(false)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!title.trim() || !content.trim()) return
		try {
			setIsSubmitting(true)
			await createThread(courseId, title, content)
			await queryClient.invalidateQueries({ queryKey: ["forum", "threads", courseId] })
			setTitle(""); setContent(""); setIsComposing(false)
		} catch (err) {
			console.error("Failed to create thread", err)
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleDelete = async (e: React.MouseEvent, threadId: number) => {
		e.stopPropagation()
		if (!confirm(t("forum.deleteThreadConfirm"))) return
		try {
			await deleteThread(courseId, threadId)
			await queryClient.invalidateQueries({ queryKey: ["forum", "threads", courseId] })
		} catch (err) {
			console.error("Failed to delete thread", err)
		}
	}

	if (isLoading) {
		return <div className="text-white/60 animate-pulse">{t("forum.loadingThreads")}</div>
	}

	if (error) {
		return (
			<div className="text-red-400 bg-red-400/10 p-4 rounded-xl border border-red-400/20">
				{t("forum.failedToLoad")}
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h3 className="text-2xl font-bold">{t("forum.title")}</h3>
				{!isComposing && currentAddress && (
					<Button variant="primary" size="sm" onClick={() => setIsComposing(true)}>
						{t("forum.startDiscussion")}
					</Button>
				)}
			</div>

			{isComposing && (
				<div className="glass-card p-6 rounded-2xl border border-brand-cyan/30 animate-in slide-in-from-top-4">
					<h4 className="text-lg font-bold mb-4">{t("forum.newThread")}</h4>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<input type="text" placeholder={t("forum.threadTitle")} value={title}
								onChange={(e) => setTitle(e.target.value)}
								className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-hidden focus:border-brand-cyan transition-colors"
							/>
						</div>
						<div>
							<textarea placeholder={t("forum.threadContent")} value={content}
								onChange={(e) => setContent(e.target.value)} rows={6}
								className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-hidden focus:border-brand-cyan transition-colors font-mono text-sm"
							/>
						</div>
						<div className="flex gap-3 justify-end pt-2">
							<Button variant="secondary" size="sm" onClick={() => setIsComposing(false)} disabled={isSubmitting}>
								{t("forum.cancel")}
							</Button>
							<Button variant="primary" size="sm" onClick={handleSubmit}
								disabled={isSubmitting || !title.trim() || !content.trim()}>
								{isSubmitting ? t("forum.posting") : t("forum.postThread")}
							</Button>
						</div>
					</form>
				</div>
			)}

			{!threads?.length && !isComposing && (
				<div className="text-center py-12 text-white/50 border border-white/5 border-dashed rounded-2xl p-8">
					<p className="text-4xl mb-4">💭</p>
					<p>{t("forum.noDiscussions")}</p>
				</div>
			)}

			<div className="space-y-4">
				{threads?.map((thread) => (
					<button key={thread.id} type="button" onClick={() => onSelectThread(thread.id)}
						className="w-full text-left glass-card p-5 rounded-2xl border border-white/10 hover:border-brand-cyan/50 transition-all flex flex-col gap-3 group">
						<div className="flex justify-between items-start gap-4">
							<h4 className="text-lg font-bold group-hover:text-brand-cyan transition-colors line-clamp-1">
								{thread.title}
							</h4>
							<div className="flex items-center gap-3 shrink-0">
								<span className="text-xs text-white/40">
									{new Date(thread.created_at).toLocaleDateString()}
								</span>
								{(isAdmin || currentAddress === thread.author_address) && (
									<span role="button" tabIndex={0}
										className="text-white/30 hover:text-red-400 transition-colors px-2 py-1"
										onClick={(e) => { e.stopPropagation(); void handleDelete(e as unknown as React.MouseEvent, thread.id) }}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ") {
												e.preventDefault(); e.stopPropagation()
												void handleDelete(e as unknown as React.MouseEvent, thread.id)
											}
										}}
										aria-label={t("common.delete")}>×</span>
								)}
							</div>
						</div>
						<div className="text-sm text-white/60 line-clamp-2 prose prose-invert max-w-none">
							<ReactMarkdown>{thread.content}</ReactMarkdown>
						</div>
						<div className="flex items-center justify-between mt-2 pt-3 border-t border-white/5">
							<WalletAddressPill address={thread.author_address} />
							<div className="text-xs font-semibold px-3 py-1 bg-white/5 rounded-full text-brand-cyan">
								{thread.reply_count}{" "}
								{thread.reply_count === 1 ? t("forum.reply", { count: thread.reply_count }) : t("forum.replyPlural", { count: thread.reply_count })}
							</div>
						</div>
					</button>
				))}
			</div>
		</div>
	)
}