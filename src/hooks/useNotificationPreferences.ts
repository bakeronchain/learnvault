import { useCallback, useEffect, useState } from "react"

const API_BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:4000"

export interface NotificationPreferences {
	milestone_approved: boolean
	milestone_rejected: boolean
	vote_result: boolean
	disbursement: boolean
	email_milestone_approved: boolean
	email_milestone_rejected: boolean
	email_vote_result: boolean
	email_disbursement: boolean
	quiet_hours_start: string | null
	quiet_hours_end: string | null
	quiet_hours_timezone: string | null
}

const defaultPrefs: NotificationPreferences = {
	milestone_approved: true,
	milestone_rejected: true,
	vote_result: true,
	disbursement: true,
	email_milestone_approved: false,
	email_milestone_rejected: false,
	email_vote_result: false,
	email_disbursement: false,
	quiet_hours_start: null,
	quiet_hours_end: null,
	quiet_hours_timezone: null,
}

export function useNotificationPreferences(token?: string) {
	const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPrefs)
	const [loading, setLoading] = useState(false)
	const [saving, setSaving] = useState(false)

	const load = useCallback(async () => {
		if (!token) return
		setLoading(true)
		try {
			const res = await fetch(`${API_BASE}/api/notifications/preferences`, {
				headers: { Authorization: `Bearer ${token}` },
			})
			if (!res.ok) return
			const data = (await res.json()) as { preferences: NotificationPreferences }
			setPreferences(data.preferences)
		} finally {
			setLoading(false)
		}
	}, [token])

	const save = useCallback(
		async (updates: Partial<NotificationPreferences>) => {
			if (!token) return
			setSaving(true)
			try {
				const res = await fetch(`${API_BASE}/api/notifications/preferences`, {
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify(updates),
				})
				if (!res.ok) return
				const data = (await res.json()) as { preferences: NotificationPreferences }
				setPreferences(data.preferences)
			} finally {
				setSaving(false)
			}
		},
		[token],
	)

	useEffect(() => {
		void load()
	}, [load])

	return { preferences, setPreferences, loading, saving, save, reload: load }
}
