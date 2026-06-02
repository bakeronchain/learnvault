import { useQuery } from "@tanstack/react-query"
import { apiFetchJson } from "../lib/api"
import { type ForumThread, type ForumThreadDetail } from "../types/forum"

export const useForumThreads = (courseId: string) => {
	return useQuery({
		queryKey: ["forum", "threads", courseId],
		queryFn: async (): Promise<ForumThread[]> => {
			const res = await apiFetchJson<{ data: ForumThread[] }>(
				`/api/courses/${courseId}/forum`,
				{ auth: true },
			)
			return res.data
		},
		enabled: Boolean(courseId),
	})
}

export const useForumThreadDetail = (courseId: string, threadId: number) => {
	return useQuery({
		queryKey: ["forum", "thread", courseId, threadId],
		queryFn: () =>
			apiFetchJson<ForumThreadDetail>(
				`/api/courses/${courseId}/forum/${threadId}`,
				{ auth: true },
			),
		enabled: Boolean(courseId) && Boolean(threadId),
	})
}

export const createThread = async (
	courseId: string,
	title: string,
	content: string,
) => {
	return apiFetchJson(`/api/courses/${courseId}/forum`, {
		method: "POST",
		auth: true,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ title, content }),
	})
}

export const replyToThread = async (
	courseId: string,
	threadId: number,
	content: string,
) => {
	return apiFetchJson(`/api/courses/${courseId}/forum/${threadId}/replies`, {
		method: "POST",
		auth: true,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ content }),
	})
}

export const deleteThread = async (courseId: string, threadId: number) => {
	return apiFetchJson(`/api/courses/${courseId}/forum/${threadId}`, {
		method: "DELETE",
		auth: true,
	})
}

export const deleteReply = async (courseId: string, replyId: number) => {
	return apiFetchJson(`/api/courses/${courseId}/forum/replies/${replyId}`, {
		method: "DELETE",
		auth: true,
	})
}
