import { useCallback, useEffect, useRef, useState } from "react"
import { enqueueOutboxItem } from "../lib/offline-db"

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
		// Offline or endpoint unavailable — enqueue for later sync
		void enqueueOutboxItem({
			id: crypto.randomUUID(),
			type: "lesson_read",
			payload: { courseSlug, lessonIds },
			courseId: courseSlug,
			createdAt: new Date().toISOString(),
			status: "pending",
			attempts: 0,
		})
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
 * retrying when the browser comes back online. When offline, actions are
 * queued to the outbox for later sync.
 */
export function useLessonProgress(courseSlug: string | undefined) {
	const [readLessonIds, setReadLessonIds] = useState<number[]>(() =>
		courseSlug ? loadFromStorage(courseSlug) : [],
	)
	const readLessonIdsRef = useRef(readLessonIds)
	readLessonIdsRef.current = readLessonIds

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
		const handleOnline = () => {
			void syncToServer(courseSlug, readLessonIdsRef.current)
		}
		window.addEventListener("online", handleOnline)
		return () => window.removeEventListener("online", handleOnline)
	}, [courseSlug])

	return { readLessonIds, markLessonRead, isLessonRead }
}
