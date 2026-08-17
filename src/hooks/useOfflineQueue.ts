import { useCallback, useEffect, useRef, useState } from "react"
import {
	type DownloadRecord,
	type OutboxItem,
	enqueueOutboxItem,
	getPendingOutboxItems,
	getFailedOutboxItems,
	getDownloadedTracks,
	saveDownload,
	deleteDownload,
	updateOutboxItem,
	clearSyncedOutbox,
} from "../lib/offline-db"

// ── Download Track ───────────────────────────────────────────────────────────

const TRACK_CACHE_PREFIX = "learnvault-track-"

interface DownloadProgress {
	trackSlug: string
	bytesDownloaded: number
	totalBytes: number
	stage: "estimating" | "downloading" | "caching" | "done" | "error"
	error?: string
}

export function useOfflineDownload() {
	const [downloadedTracks, setDownloadedTracks] = useState<DownloadRecord[]>([])
	const [progress, setProgress] = useState<DownloadProgress | null>(null)

	useEffect(() => {
		void getDownloadedTracks().then(setDownloadedTracks)
	}, [])

	const isDownloaded = useCallback(
		(trackSlug: string) =>
			downloadedTracks.some((t) => t.trackSlug === trackSlug),
		[downloadedTracks],
	)

	const downloadTrack = useCallback(
		async (
			trackSlug: string,
			trackTitle: string,
			courseSlugs: string[],
			fetchCourseDetail: (slug: string) => Promise<Response>,
		) => {
			if (!navigator.onLine) {
				setProgress({
					trackSlug,
					bytesDownloaded: 0,
					totalBytes: 0,
					stage: "error",
					error: "No internet connection",
				})
				return
			}

			setProgress({
				trackSlug,
				bytesDownloaded: 0,
				totalBytes: 0,
				stage: "estimating",
			})

			try {
				const cacheName = `${TRACK_CACHE_PREFIX}${trackSlug}`
				const cache = await caches.open(cacheName)
				let totalBytes = 0
				let bytesDownloaded = 0

				// Phase 1: Fetch all course details and estimate size
				const responses: { url: string; response: Response }[] = []
				for (const slug of courseSlugs) {
					const res = await fetchCourseDetail(slug)
					const text = await res.text()
					totalBytes += text.length * 2 // rough UTF-16 byte estimate
					responses.push({
						url: `/api/courses/${slug}`,
						response: new Response(text, res),
					})

					try {
						const data = JSON.parse(text) as Record<string, unknown>
						const lessons = (data.lessons ?? []) as Array<
							Record<string, unknown>
						>
						for (const lesson of lessons) {
							const content = String(
								lesson.content ?? lesson.content_markdown ?? "",
							)
							totalBytes += content.length * 2
						}
					} catch {
						// Ignore parse errors
					}
				}

				// Phase 2: Cache everything
				setProgress({
					trackSlug,
					bytesDownloaded: 0,
					totalBytes,
					stage: "downloading",
				})

				for (const { url, response } of responses) {
					await cache.put(url, response)
					bytesDownloaded += Math.round(totalBytes / courseSlugs.length)
					setProgress((prev) =>
						prev ? { ...prev, bytesDownloaded } : prev,
					)
				}

				// Phase 3: Store manifest in IndexedDB
				const record: DownloadRecord = {
					trackSlug,
					title: trackTitle,
					downloadedAt: new Date().toISOString(),
					courseSlugs,
					totalSize: totalBytes,
					manifestVersion: 1,
				}
				await saveDownload(record)
				setDownloadedTracks((prev) => {
					const without = prev.filter((t) => t.trackSlug !== trackSlug)
					return [...without, record]
				})

				setProgress({
					trackSlug,
					bytesDownloaded: totalBytes,
					totalBytes,
					stage: "done",
				})
			} catch (err) {
				setProgress({
					trackSlug,
					bytesDownloaded: 0,
					totalBytes: 0,
					stage: "error",
					error: err instanceof Error ? err.message : "Download failed",
				})
			}
		},
		[],
	)

	const deleteTrack = useCallback(async (trackSlug: string) => {
		const cacheName = `${TRACK_CACHE_PREFIX}${trackSlug}`
		await caches.delete(cacheName)
		await deleteDownload(trackSlug)
		setDownloadedTracks((prev) =>
			prev.filter((t) => t.trackSlug !== trackSlug),
		)
	}, [])

	return {
		downloadedTracks,
		progress,
		isDownloaded,
		downloadTrack,
		deleteTrack,
		clearProgress: () => setProgress(null),
	}
}

// ── Offline Queue ────────────────────────────────────────────────────────────

export interface QueueState {
	pendingCount: number
	failedItems: OutboxItem[]
}

const MAX_ATTEMPTS = 5
const BASE_BACKOFF_MS = 1000

export function useOfflineQueue() {
	const [state, setState] = useState<QueueState>({
		pendingCount: 0,
		failedItems: [],
	})
	const drainingRef = useRef(false)

	const refreshState = useCallback(async () => {
		const [pending, failed] = await Promise.all([
			getPendingOutboxItems(),
			getFailedOutboxItems(),
		])
		setState({ pendingCount: pending.length, failedItems: failed })
	}, [])

	useEffect(() => {
		void refreshState()
	}, [refreshState])

	const enqueue = useCallback(
		async (
			item: Omit<OutboxItem, "id" | "createdAt" | "status" | "attempts">,
		) => {
			const full: OutboxItem = {
				...item,
				id: crypto.randomUUID(),
				createdAt: new Date().toISOString(),
				status: "pending",
				attempts: 0,
			}
			await enqueueOutboxItem(full)
			await refreshState()
			return full.id
		},
		[refreshState],
	)

	const drain = useCallback(async () => {
		if (drainingRef.current) return
		drainingRef.current = true

		try {
			const pending = await getPendingOutboxItems()

			for (const item of pending) {
				try {
					const headers: Record<string, string> = {
						"Content-Type": "application/json",
						"X-Idempotency-Key": item.id,
					}
					const token =
						localStorage.getItem("auth_token") ||
						localStorage.getItem("authToken")
					if (token) headers["Authorization"] = `Bearer ${token}`

					let endpoint = ""
					let body: Record<string, unknown> = {}

					switch (item.type) {
						case "lesson_read":
							endpoint = "/api/me/lesson-progress"
							body = item.payload as Record<string, unknown>
							break
						case "milestone_evidence":
							endpoint = "/api/milestones"
							body = item.payload as Record<string, unknown>
							break
						case "quiz_submission":
							endpoint = "/api/me/lesson-progress"
							body = item.payload as Record<string, unknown>
							break
					}

					if (!endpoint) continue

					const res = await fetch(endpoint, {
						method: "POST",
						headers,
						body: JSON.stringify(body),
					})

					// 409 = conflict / already processed (idempotent accept)
					if (!res.ok && res.status !== 409) {
						throw new Error(`HTTP ${res.status}`)
					}

					await updateOutboxItem({
						...item,
						status: "synced",
						attempts: item.attempts + 1,
					})
				} catch (err) {
					const attempts = item.attempts + 1
					const status: OutboxItem["status"] =
						attempts >= MAX_ATTEMPTS ? "failed" : "pending"
					await updateOutboxItem({
						...item,
						status,
						attempts,
						lastAttemptAt: new Date().toISOString(),
						errorMessage:
							err instanceof Error ? err.message : String(err),
					})

					if (status === "pending") {
						const delay = Math.min(
							30000,
							BASE_BACKOFF_MS * 2 ** (attempts - 1),
						)
						await new Promise((r) => setTimeout(r, delay))
					}
				}
			}

			await clearSyncedOutbox()
			await refreshState()
		} finally {
			drainingRef.current = false
		}
	}, [refreshState])

	// Auto-drain on reconnect
	useEffect(() => {
		const handleOnline = () => void drain()
		window.addEventListener("online", handleOnline)
		return () => window.removeEventListener("online", handleOnline)
	}, [drain])

	return { ...state, enqueue, drain, refreshState }
}
