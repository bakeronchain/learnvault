import { useQuery } from "@tanstack/react-query"
import { apiFetchJson, buildApiUrl } from "../lib/api"
import { type ForumThread, type ForumThreadDetail } from "../types/forum"

export const useForumThreads = (courseId: string) => {
	return useQuery({
		queryKey: ["forum", "threads", courseId],
		queryFn: async (): Promise<ForumThread[]> => {
			const res = await apiFetchJson<{ data: ForumThread[] }>(
				buildApiUrl(`/api/courses/${courseId}/forum`),
			)
			return res.data
		},
		enabled: Boolean(courseId),
	})
}

export const useForumThreadDetail = (courseId: string, threadId: number) => {
	return useQuery({
		queryKey: ["forum", "thread", courseId, threadId],
		queryFn: async (): Promise<ForumThreadDetail> => {
			return apiFetchJson<ForumThreadDetail>(
				buildApiUrl(`/api/courses/${courseId}/forum/${threadId}`),
			)
		},
		enabled: Boolean(courseId) && Boolean(threadId),
	})
}

export const createThread = async (
	courseId: string,
	title: string,
	content: string,
) => {
	return apiFetchJson(buildApiUrl(`/api/courses/${courseId}/forum`), {
		method: "POST",
		body: JSON.stringify({ title, content }),
	})
}

export const replyToThread = async (
	courseId: string,
	threadId: number,
	content: string,
) => {
	return apiFetchJson(
		buildApiUrl(`/api/courses/${courseId}/forum/${threadId}/replies`),
		{
			method: "POST",
			body: JSON.stringify({ content }),
		},
	)
}

export const deleteThread = async (courseId: string, threadId: number) => {
	return apiFetchJson(
		buildApiUrl(`/api/courses/${courseId}/forum/${threadId}`),
		{
			method: "DELETE",
		},
	)
}

export const deleteReply = async (courseId: string, replyId: number) => {
	return apiFetchJson(
		buildApiUrl(`/api/courses/${courseId}/forum/replies/${replyId}`),
		{
			method: "DELETE",
		},
	)
}
