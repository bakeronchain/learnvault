import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useWallet } from "./useWallet"

export interface Bookmark {
	bookmark_id: number
	course_id: string
	created_at: string
}

const BOOKMARKS_QUERY_KEY = ["bookmarks"] as const

function authHeaders(): Record<string, string> {
	return {
		"Content-Type": "application/json",
		Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
	}
}

/**
 * List + toggle bookmarks for the connected wallet.
 *
 * Server is the source of truth — bookmarks persist across devices and
 * sessions automatically. Toggling uses optimistic updates so the heart
 * icon flips immediately, rolling back if the server call fails.
 */
export function useBookmarks() {
	const { address } = useWallet()
	const queryClient = useQueryClient()

	const bookmarksQuery = useQuery<Bookmark[]>({
		queryKey: [...BOOKMARKS_QUERY_KEY, address],
		queryFn: async () => {
			const response = await fetch("/api/me/bookmarks", {
				method: "GET",
				headers: authHeaders(),
			})
			if (!response.ok) {
				const err = await response.json().catch(() => ({}))
				throw new Error(err.error ?? "Failed to fetch bookmarks")
			}
			const body = (await response.json()) as { data: Bookmark[] }
			return body.data
		},
		enabled: !!address,
		staleTime: 60 * 1000, // 1 minute
	})

	const bookmarkedCourseIds = new Set(
		(bookmarksQuery.data ?? []).map((b) => b.course_id),
	)

	const isBookmarked = (courseId: string) => bookmarkedCourseIds.has(courseId)

	const toggleMutation = useMutation<
		void,
		Error,
		{ courseId: string; next: "on" | "off" },
		{ previous?: Bookmark[] }
	>({
		mutationFn: async ({ courseId, next }) => {
			const url =
				next === "on"
					? "/api/me/bookmarks"
					: `/api/me/bookmarks/${encodeURIComponent(courseId)}`
			const method = next === "on" ? "POST" : "DELETE"
			const body = next === "on" ? JSON.stringify({ course_id: courseId }) : undefined

			const response = await fetch(url, {
				method,
				headers: authHeaders(),
				body,
			})
			if (!response.ok) {
				const err = await response.json().catch(() => ({}))
				throw new Error(err.error ?? "Failed to toggle bookmark")
			}
		},
		onMutate: async ({ courseId, next }) => {
			await queryClient.cancelQueries({ queryKey: [...BOOKMARKS_QUERY_KEY, address] })
			const previous = queryClient.getQueryData<Bookmark[]>([
				...BOOKMARKS_QUERY_KEY,
				address,
			])

			queryClient.setQueryData<Bookmark[]>(
				[...BOOKMARKS_QUERY_KEY, address],
				(old = []) => {
					if (next === "off") {
						return old.filter((b) => b.course_id !== courseId)
					}
					if (old.some((b) => b.course_id === courseId)) return old
					return [
						{
							bookmark_id: -1, // server fills real id on refetch
							course_id: courseId,
							created_at: new Date().toISOString(),
						},
						...old,
					]
				},
			)

			return { previous }
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(
					[...BOOKMARKS_QUERY_KEY, address],
					context.previous,
				)
			}
		},
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: [...BOOKMARKS_QUERY_KEY, address],
			})
		},
	})

	const toggleBookmark = (courseId: string) => {
		if (!address) return
		toggleMutation.mutate({
			courseId,
			next: isBookmarked(courseId) ? "off" : "on",
		})
	}

	return {
		bookmarks: bookmarksQuery.data ?? [],
		isLoading: bookmarksQuery.isLoading,
		error: bookmarksQuery.error instanceof Error ? bookmarksQuery.error.message : null,
		isBookmarked,
		toggleBookmark,
		isToggling: toggleMutation.isPending,
		address,
	}
}
