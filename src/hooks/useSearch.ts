import { useEffect, useRef, useState } from "react"
import { API_URL } from "../lib/api"

export interface SearchResults {
	type: "course" | "lesson" | "wiki" | "forum" | "profile"
	id: string
	title: string
	snippet: string
	url: string
}

const MAX_QUERY_LENGTH = 200

/**
 * Fetches platform-wide search results with a stable cursor. Aborts the
 * in-flight request whenever the query or cursor changes — the caller owns
 * debouncing.
 */
export function useSearch(query: string, type?: string, cursor?: string) {
	const [data, setData] = useState<SearchResults[]>([])
	const [nextCursor, setNextCursor] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [isError, setIsError] = useState(false)
	const abortRef = useRef<AbortController | null>(null)

	useEffect(() => {
		if (abortRef.current) {
			abortRef.current.abort()
		}
		abortRef.current = new AbortController()

		return () => {
			abortRef.current?.abort()
		}
	}, [query, type, cursor])

	async function run(signal: AbortSignal) {
		setIsLoading(true)
		setIsError(false)
		try {
			const url = new URL(`${API_URL}/api/search`)
			url.searchParams.set("q", query.slice(0, MAX_QUERY_LENGTH))
			if (type) url.searchParams.set("type", type)
			if (cursor) url.searchParams.set("cursor", cursor)
			const response = await fetch(url.toString(), { signal })
			if (!response.ok) {
				throw new Error(`Search failed: ${response.status}`)
			}
			const body = (await response.json()) as {
				data: SearchResults[]
				nextCursor: string | null
			}
			setData(body.data)
			setNextCursor(body.nextCursor)
		} catch (err: any) {
			if (err?.name !== "AbortError") {
				setIsError(true)
				setData([])
				setNextCursor(null)
			}
		} finally {
			if (!signal.aborted) {
				setIsLoading(false)
			}
		}
	}

	function refetch() {
		if (query.trim().length >= 2 && abortRef.current) {
			void run(abortRef.current.signal)
		} else {
			setData([])
			setNextCursor(null)
			setIsLoading(false)
		}
	}

	// Run on every change of inputs.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => {
		void refetch()
	}, [query, type, cursor])

	return { data, nextCursor, isLoading, isError }
}

const RECENT_SEARCHES_KEY = "learnvault:recent-searches"
const MAX_RECENT = 8

export function getRecentSearches(): string[] {
	try {
		const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
		const parsed = raw ? (JSON.parse(raw) as unknown) : []
		return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : []
	} catch {
		return []
	}
}

export function addRecentSearch(query: string): void {
	try {
		const trimmed = query.trim()
		if (!trimmed) return
		const next = [trimmed, ...getRecentSearches().filter((s) => s !== trimmed)].slice(0, MAX_RECENT)
		localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next))
	} catch {
		// localStorage unavailable (private mode) — non-fatal
	}
}

export function clearRecentSearches(): void {
	try {
		localStorage.removeItem(RECENT_SEARCHES_KEY)
	} catch {
		// non-fatal
	}
}
