import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { createAuthHeaders } from "../lib/api"
import { useWallet } from "./useWallet"

export interface Bookmark {
	bookmark_id: number
	course_id: string
	created_at: string
}

const BOOKMARKS_QUERY_KEY = ["bookmarks"] as const

/**
 * Build headers for authenticated bookmark requests. Delegates to the shared
 * `createAuthHeaders` / `getAuthToken` pair so we stay in sync with the
 * codebase's "authToken" + "auth_token" storage-key fallback. When no token
 * is present, `createAuthHeaders()` omits the Authorization header entirely
 * — it does NOT send a malformed `Authorization: Bearer` with an empty value.
 */
function authHeaders(): Headers {
	const headers = createAuthHeaders()
	headers.set("Content-Type", "application/json")
	return headers
}

/**
 * Apply a single-item toggle to a bookmarks list. Used for both optimistic
 * mutation and error rollback so they're symmetric and never snapshot the
 * whole list — that way concurrent toggles on different course IDs don't
 * clobber each other's in-flight state on failure.
 */
function applyToggle(
	list: Bookmark[],
	courseId: string,
	next: "on" | "off",
): Bookmark[] {
	if (next === "off") {
		return list.filter((b) => b.course_id !== courseId)
	}
	if (list.some((b) => b.course_id === courseId)) return list
	return [
		{
			bookmark_id: -1, // server fills real id on refetch
			course_id: courseId,
			created_at: new Date().toISOString(),
		},
		...list,
	]
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
		{ courseId: string; next: "on" | "off" }
	>({
		mutationFn: async ({ courseId, next }) => {
			const url =
				next === "on"
					? "/api/me/bookmarks"
					: `/api/me/bookmarks/${encodeURIComponent(courseId)}`
			const method = next === "on" ? "POST" : "DELETE"
			const body =
				next === "on" ? JSON.stringify({ course_id: courseId }) : undefined

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
		// Granular optimistic updates: we never snapshot/restore the whole list.
		// Instead we apply the single-item delta on mutate, and reverse the same
		// single-item delta on error. That way two concurrent toggles on
		// different course IDs don't clobber each other on rollback.
		onMutate: async ({ courseId, next }) => {
			await queryClient.cancelQueries({
				queryKey: [...BOOKMARKS_QUERY_KEY, address],
			})
			queryClient.setQueryData<Bookmark[]>(
				[...BOOKMARKS_QUERY_KEY, address],
				(old = []) => applyToggle(old, courseId, next),
			)
		},
		onError: (_err, { courseId, next }) => {
			// Reverse the specific delta we applied — don't touch other rows
			const reverse = next === "on" ? "off" : "on"
			queryClient.setQueryData<Bookmark[]>(
				[...BOOKMARKS_QUERY_KEY, address],
				(current = []) => applyToggle(current, courseId, reverse),
			)
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
		error:
			bookmarksQuery.error instanceof Error
				? bookmarksQuery.error.message
				: null,
		isBookmarked,
		toggleBookmark,
		isToggling: toggleMutation.isPending,
		address,
	}
}
