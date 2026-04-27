import { useCallback, useEffect, useRef, useState } from "react"

const API_BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:4000"

export interface AppNotification {
	id: number
	type: string
	message: string
	href?: string
	is_read: boolean
	created_at: string
}

interface NotificationsState {
	notifications: AppNotification[]
	unread_count: number
}

export function useNotifications(token?: string) {
	const [state, setState] = useState<NotificationsState>({
		notifications: [],
		unread_count: 0,
	})
	const [loading, setLoading] = useState(false)
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

	const fetchNotifications = useCallback(async () => {
		if (!token) return
		setLoading(true)
		try {
			const res = await fetch(`${API_BASE}/api/notifications`, {
				headers: { Authorization: `Bearer ${token}` },
			})
			if (res.ok) {
				const data: NotificationsState = await res.json()
				setState(data)
			}
		} catch {
			// Silently ignore network errors for background polling
		} finally {
			setLoading(false)
		}
	}, [token])

	const markAllRead = useCallback(async () => {
		if (!token) return
		try {
			await fetch(`${API_BASE}/api/notifications/read-all`, {
				method: "PATCH",
				headers: { Authorization: `Bearer ${token}` },
			})
			setState((prev) => ({
				...prev,
				unread_count: 0,
				notifications: prev.notifications.map((n) => ({ ...n, is_read: true })),
			}))
		} catch {
			// ignore
		}
	}, [token])

	const markOneRead = useCallback(
		async (id: number) => {
			if (!token) return
			try {
				await fetch(`${API_BASE}/api/notifications/${id}/read`, {
					method: "PATCH",
					headers: { Authorization: `Bearer ${token}` },
				})
				setState((prev) => ({
					unread_count: Math.max(0, prev.unread_count - 1),
					notifications: prev.notifications.map((n) =>
						n.id === id ? { ...n, is_read: true } : n,
					),
				}))
			} catch {
				// ignore
			}
		},
		[token],
	)

	// Fetch on mount and poll every 30s
	useEffect(() => {
		void fetchNotifications()

		if (token) {
			intervalRef.current = setInterval(() => {
				void fetchNotifications()
			}, 30_000)
		}

		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current)
		}
	}, [fetchNotifications, token])

	return {
		notifications: state.notifications,
		unreadCount: state.unread_count,
		loading,
		markAllRead,
		markOneRead,
		refetch: fetchNotifications,
	}
}
