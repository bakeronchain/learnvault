import { useCallback, useEffect, useState } from "react"

const storageKey = (courseSlug: string) => `learnvault:progress:${courseSlug}`

async function syncToServer(courseSlug: string, lessonIds: number[]) {
	const token = localStorage.getItem("auth_token")
	if (!token) return
	try {
		await fetch("/api/me/lesson-progress", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ courseSlug, lessonIds }),
		})
	} catch {
		// Offline or endpoint unavailable — localStorage remains source of truth
	}
}

function loadFromStorage(courseSlug: string): number[] {
	try {
		const raw = localStorage.getItem(storageKey(courseSlug))
		return raw ? (JSON.parse(raw) as number[]) : []
	} catch {
		return []
	}
}

/**
 * Tracks which lessons the user has read (scrolled to the bottom of).
 * Persists in localStorage immediately and syncs to the server best-effort,
 * retrying when the browser comes back online.
 */
export function useLessonProgress(courseSlug: string | undefined) {
	const [readLessonIds, setReadLessonIds] = useState<number[]>(() =>
		courseSlug ? loadFromStorage(courseSlug) : [],
	)

	// Re-hydrate when the course changes
	useEffect(() => {
		setReadLessonIds(courseSlug ? loadFromStorage(courseSlug) : [])
	}, [courseSlug])

	const markLessonRead = useCallback(
		(lessonId: number) => {
			if (!courseSlug) return
			setReadLessonIds((prev) => {
				if (prev.includes(lessonId)) return prev
				const next = [...prev, lessonId]
				try {
					localStorage.setItem(storageKey(courseSlug), JSON.stringify(next))
				} catch {
					// Storage full or unavailable
				}
				void syncToServer(courseSlug, next)
				return next
			})
		},
		[courseSlug],
	)

	const isLessonRead = useCallback(
		(lessonId: number) => readLessonIds.includes(lessonId),
		[readLessonIds],
	)

	// Retry server sync whenever the browser reconnects
	useEffect(() => {
		if (!courseSlug) return
		const handleOnline = () => void syncToServer(courseSlug, readLessonIds)
		window.addEventListener("online", handleOnline)
		return () => window.removeEventListener("online", handleOnline)
	}, [courseSlug, readLessonIds])

	return { readLessonIds, markLessonRead, isLessonRead }
}
