import { useQuery } from "@tanstack/react-query"
import { api } from "../util/api"
import { type ForumThread, type ForumThreadDetail } from "../types/forum"

export const useForumThreads = (courseId: string) => {
    return useQuery({
        queryKey: ["forum", "threads", courseId],
        queryFn: async (): Promise<ForumThread[]> => {
            const res = await api.get(`/courses/${courseId}/forum`)
            return res.data.data
        },
        enabled: Boolean(courseId),
    })
}

export const useForumThreadDetail = (courseId: string, threadId: number) => {
    return useQuery({
        queryKey: ["forum", "thread", courseId, threadId],
        queryFn: async (): Promise<ForumThreadDetail> => {
            const res = await api.get(`/courses/${courseId}/forum/${threadId}`)
            return res.data
        },
        enabled: Boolean(courseId) && Boolean(threadId),
    })
}

export const createThread = async (courseId: string, title: string, content: string) => {
    const res = await api.post(`/courses/${courseId}/forum`, { title, content })
    return res.data
}

export const replyToThread = async (courseId: string, threadId: number, content: string) => {
    const res = await api.post(`/courses/${courseId}/forum/${threadId}/replies`, { content })
    return res.data
}

export const deleteThread = async (courseId: string, threadId: number) => {
    const res = await api.delete(`/courses/${courseId}/forum/${threadId}`)
    return res.data
}

export const deleteReply = async (courseId: string, replyId: number) => {
    const res = await api.delete(`/courses/${courseId}/forum/replies/${replyId}`)
    return res.data
}
