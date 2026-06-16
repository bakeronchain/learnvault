import { useMemo } from "react"
import { Link } from "react-router-dom"
import { useNotificationPreferences } from "../hooks/useNotificationPreferences"
import { getAuthToken } from "../util/auth"

const EVENT_OPTIONS = [
	{ key: "milestone_approved", label: "Milestone approved" },
	{ key: "milestone_rejected", label: "Milestone rejected" },
	{ key: "vote_result", label: "Vote result" },
	{ key: "disbursement", label: "Disbursement received" },
] as const

export default function NotificationSettings() {
	const token = getAuthToken()
	const { preferences, loading, saving, save } = useNotificationPreferences(token)

	const timezone = useMemo(
		() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
		[],
	)

	if (!token) {
		return (
			<section className="mx-auto max-w-3xl px-6 py-12">
				<h1 className="text-2xl font-bold text-white">Notification settings</h1>
				<p className="mt-3 text-white/70">Sign in to manage notification delivery.</p>
			</section>
		)
	}

	return (
		<section className="mx-auto max-w-3xl px-6 py-12 space-y-8">
			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-white">Notification settings</h1>
					<p className="mt-2 text-sm text-white/70">
						Choose which events send browser and email notifications.
					</p>
				</div>
				<Link
					to="/dashboard"
					className="min-h-10 inline-flex items-center rounded-lg px-4 text-sm font-semibold text-brand-cyan hover:text-brand-cyan/80"
				>
					Back to dashboard
				</Link>
			</div>

			<div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
				<h2 className="text-lg font-semibold text-white">Event preferences</h2>
				{EVENT_OPTIONS.map((option) => {
					const emailKey = `email_${option.key}` as const
					return (
						<div
							key={option.key}
							className="grid gap-3 rounded-xl border border-white/10 bg-black/10 p-4 sm:grid-cols-[1fr_auto_auto]"
						>
							<span className="text-sm text-white">{option.label}</span>
							<label className="inline-flex min-h-10 items-center gap-2 text-xs text-white/80">
								<input
									type="checkbox"
									checked={preferences[option.key]}
									onChange={(e) =>
										void save({ [option.key]: e.target.checked })
									}
								/>
								Browser push
							</label>
							<label className="inline-flex min-h-10 items-center gap-2 text-xs text-white/80">
								<input
									type="checkbox"
									checked={preferences[emailKey]}
									onChange={(e) =>
										void save({ [emailKey]: e.target.checked })
									}
								/>
								Email
							</label>
						</div>
					)
				})}
			</div>

			<div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
				<h2 className="text-lg font-semibold text-white">Quiet hours</h2>
				<p className="text-sm text-white/70">
					Pause browser push notifications during your quiet window.
				</p>
				<div className="grid gap-4 sm:grid-cols-3">
					<label className="text-xs text-white/70 space-y-2">
						Start
						<input
							type="time"
							className="w-full min-h-10 rounded-lg border border-white/20 bg-transparent px-3 text-sm text-white"
							value={preferences.quiet_hours_start ?? ""}
							onChange={(e) =>
								void save({ quiet_hours_start: e.target.value || null })
							}
						/>
					</label>
					<label className="text-xs text-white/70 space-y-2">
						End
						<input
							type="time"
							className="w-full min-h-10 rounded-lg border border-white/20 bg-transparent px-3 text-sm text-white"
							value={preferences.quiet_hours_end ?? ""}
							onChange={(e) =>
								void save({ quiet_hours_end: e.target.value || null })
							}
						/>
					</label>
					<div className="text-xs text-white/60">
						Timezone
						<p className="mt-2 min-h-10 rounded-lg border border-white/20 px-3 py-2 text-sm text-white">
							{preferences.quiet_hours_timezone || timezone}
						</p>
					</div>
				</div>
				<button
					type="button"
					className="min-h-10 rounded-lg bg-brand-cyan px-4 text-sm font-semibold text-black disabled:opacity-60"
					disabled={saving}
					onClick={() => void save({ quiet_hours_timezone: timezone })}
				>
					Use current timezone
				</button>
			</div>

			{loading && <p className="text-sm text-white/60">Loading preferences...</p>}
			{saving && <p className="text-sm text-white/60">Saving changes...</p>}
		</section>
	)
}
