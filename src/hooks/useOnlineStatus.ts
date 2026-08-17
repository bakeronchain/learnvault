import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Tracks browser online/offline status.
 * `wasOffline` becomes true for a short period after reconnect so the UI can
 * show a "back online" message before dismissing the indicator.
 */
export function useOnlineStatus() {
	const [isOnline, setIsOnline] = useState(navigator.onLine)
	const [wasOffline, setWasOffline] = useState(false)
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		const handleOnline = () => {
			setIsOnline(true)
			setWasOffline(true)
			if (timerRef.current) clearTimeout(timerRef.current)
			timerRef.current = setTimeout(() => setWasOffline(false), 5000)
		}
		const handleOffline = () => {
			setIsOnline(false)
			setWasOffline(false)
		}

		window.addEventListener("online", handleOnline)
		window.addEventListener("offline", handleOffline)
		return () => {
			window.removeEventListener("online", handleOnline)
			window.removeEventListener("offline", handleOffline)
			if (timerRef.current) clearTimeout(timerRef.current)
		}
	}, [])

	const checkOnline = useCallback(async (): Promise<boolean> => {
		if (navigator.onLine) return true
		// For cases where navigator.onLine is stale (e.g. behind captive portal)
		try {
			const ctrl = new AbortController()
			const id = setTimeout(() => ctrl.abort(), 3000)
			const res = await fetch("/api/courses", {
				method: "HEAD",
				signal: ctrl.signal,
				cache: "no-store",
			})
			clearTimeout(id)
			const online = res.ok
			setIsOnline(online)
			return online
		} catch {
			setIsOnline(false)
			return false
		}
	}, [])

	return { isOnline, wasOffline, checkOnline }
}
