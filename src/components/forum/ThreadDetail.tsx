import { Button } from "@stellar/design-system"
import React, { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import ReactMarkdown from "react-markdown"
import { deleteReply, deleteThread, replyToThread, useForumThreadDetail } from "../../hooks/useForum"
import { WalletAddressPill } from "../WalletAddressPill"

interface ThreadDetailProps {
    courseId: string
    threadId: number
    onBack: () => void
    currentAddress: string | null
    isAdmin: boolean
}

export const ThreadDetail: React.FC<ThreadDetailProps> = ({ courseId, threadId, onBack, currentAddress, isAdmin }) => {
    const { data: thread, isLoading, error } = useForumThreadDetail(courseId, threadId)
    const queryClient = useQueryClient()
    const [replyContent, setReplyContent] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleReply = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!replyContent.trim()) return

        try {
            setIsSubmitting(true)
            await replyToThread(courseId, threadId, replyContent)
            await queryClient.invalidateQueries({ queryKey: ["forum", "thread", courseId, threadId] })
            await queryClient.invalidateQueries({ queryKey: ["forum", "threads", courseId] })
            setReplyContent("")
        } catch (err) {
            console.error("Failed to post reply", err)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteThread = async () => {
        if (!confirm("Are you sure you want to delete this thread?")) return
        try {
            await deleteThread(courseId, threadId)
            await queryClient.invalidateQueries({ queryKey: ["forum", "threads", courseId] })
            onBack()
        } catch (err) {
            console.error("Failed to delete thread", err)
        }
    }

    const handleDeleteReply = async (replyId: number) => {
        if (!confirm("Are you sure you want to delete this reply?")) return
        try {
            await deleteReply(courseId, replyId)
            await queryClient.invalidateQueries({ queryKey: ["forum", "thread", courseId, threadId] })
        } catch (err) {
            console.error("Failed to delete reply", err)
        }
    }

    if (isLoading) {
        return <div className="text-white/60 animate-pulse">Loading discussion...</div>
    }

    if (error || !thread) {
        return (
            <div className="space-y-4">
                <Button variant="secondary" size="sm" onClick={onBack}>← Back to Discussions</Button>
                <div className="text-red-400 bg-red-400/10 p-4 rounded-xl border border-red-400/20">Thread not found or failed to load.</div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div>
                <button type="button" onClick={onBack} className="text-white/50 hover:text-white transition-colors text-sm mb-4 inline-flex items-center gap-2">
                    <span>←</span> Back to Discussions
                </button>
                <div className="flex justify-between items-start gap-4 mb-6">
                    <h2 className="text-3xl font-bold text-white">{thread.title}</h2>
                    { (isAdmin || currentAddress === thread.author_address) && (
                        <button 
                            type="button" 
                            className="text-red-400/60 hover:text-red-400 transition-colors shrink-0 text-sm"
                            onClick={handleDeleteThread}
                        >
                            Delete Thread
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-3 text-sm text-white/50 mb-8 border-b border-white/10 pb-6">
                    <WalletAddressPill address={thread.author_address} />
                    <span>•</span>
                    <span>{new Date(thread.created_at).toLocaleString()}</span>
                </div>
                
                <div className="prose prose-invert max-w-none text-white/80 pb-8 border-b border-white/10">
                    <ReactMarkdown>{thread.content}</ReactMarkdown>
                </div>
            </div>

            <div className="space-y-6">
                <h3 className="text-xl font-bold text-white">Replies ({thread.replies?.length || 0})</h3>
                
                {thread.replies?.length === 0 ? (
                    <div className="text-white/40 text-center py-6 glass-card rounded-2xl">
                        No replies yet.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {thread.replies.map(reply => (
                            <div key={reply.id} className="glass-card p-5 rounded-2xl border border-white/10 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3 text-xs text-white/50">
                                        <WalletAddressPill address={reply.author_address} />
                                        <span>•</span>
                                        <span>{new Date(reply.created_at).toLocaleString()}</span>
                                    </div>
                                    { (isAdmin || currentAddress === reply.author_address) && (
                                        <button 
                                            type="button" 
                                            className="text-white/30 hover:text-red-400 transition-colors px-2 py-1"
                                            onClick={() => handleDeleteReply(reply.id)}
                                            title="Delete reply"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                                <div className="prose prose-sm prose-invert max-w-none text-white/70">
                                    <ReactMarkdown>{reply.content}</ReactMarkdown>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {currentAddress ? (
                <div className="glass-card p-6 rounded-2xl border border-brand-cyan/20">
                    <h4 className="font-bold mb-4">Add a Reply</h4>
                    <form onSubmit={handleReply} className="space-y-4">
                        <textarea
                            placeholder="Type your response here (Markdown supported)..."
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            rows={4}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-hidden focus:border-brand-cyan transition-colors font-mono text-sm"
                        />
                        <div className="flex justify-end">
                            <Button variant="primary" size="sm" onClick={handleReply} disabled={isSubmitting || !replyContent.trim()}>
                                {isSubmitting ? "Posting..." : "Post Reply"}
                            </Button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="bg-white/5 p-6 rounded-2xl text-center">
                    <p className="text-white/60 mb-3">You must be connected to reply.</p>
                </div>
            )}
        </div>
    )
}
