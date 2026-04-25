import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
	type AppNotification,
	useNotifications,
} from "../hooks/useNotifications"

interface NotificationBellProps {
	/** JWT token for the current user — omit if unauthenticated */
	token?: string
}

export function NotificationBell({ token }: NotificationBellProps) {
	const [open, setOpen] = useState(false)
	const panelRef = useRef<HTMLDivElement>(null)
	const buttonRef = useRef<HTMLButtonElement>(null)
	const navigate = useNavigate()

	const { notifications, unreadCount, markAllRead, markOneRead } =
		useNotifications(token)

	// Close on outside click or Escape key; trap focus while open
	useEffect(() => {
		if (!open) return

		// Move focus into panel on open
		setTimeout(() => {
			const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
				"button, [href], input, [tabindex]:not([tabindex='-1'])",
			)
			firstFocusable?.focus()
		}, 0)

		function handlePointerDown(e: MouseEvent) {
			if (
				panelRef.current &&
				!panelRef.current.contains(e.target as Node) &&
				buttonRef.current &&
				!buttonRef.current.contains(e.target as Node)
			) {
				setOpen(false)
			}
		}

		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") {
				e.preventDefault()
				setOpen(false)
				buttonRef.current?.focus()
				return
			}

			if (e.key !== "Tab") return
			const focusableSelectors =
				"button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex='-1'])"
			const focusable = Array.from(
				panelRef.current?.querySelectorAll<HTMLElement>(focusableSelectors) ??
					[],
			)
			if (focusable.length === 0) return
			const first = focusable[0]
			const last = focusable[focusable.length - 1]
			if (e.shiftKey) {
				if (document.activeElement === first) {
					e.preventDefault()
					last.focus()
				}
			} else {
				if (document.activeElement === last) {
					e.preventDefault()
					first.focus()
				}
			}
		}

		document.addEventListener("mousedown", handlePointerDown)
		document.addEventListener("keydown", handleKeyDown)
		return () => {
			document.removeEventListener("mousedown", handlePointerDown)
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [open])

	const handleNotificationClick = async (notification: AppNotification) => {
		if (!notification.is_read) {
			await markOneRead(notification.id)
		}
		setOpen(false)
		if (notification.href) {
			void navigate(notification.href)
		}
	}

	const handleMarkAllRead = async () => {
		await markAllRead()
	}

	if (!token) return null

	return (
		<div className="relative shrink-0">
			<button
				ref={buttonRef}
				type="button"
				aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
				aria-haspopup="dialog"
				aria-expanded={open}
				onClick={() => setOpen((o) => !o)}
				className="relative w-9 h-9 flex items-center justify-center rounded-xl glass border border-white/10 text-white/70 hover:text-white transition-colors"
			>
				{/* Bell icon */}
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="w-4 h-4"
					aria-hidden="true"
				>
					<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
					<path d="M13.73 21a2 2 0 0 1-3.46 0" />
				</svg>

				{/* Unread badge */}
				{unreadCount > 0 && (
					<span
						aria-hidden="true"
						className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-brand-cyan text-black text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow"
					>
						{unreadCount > 99 ? "99+" : unreadCount}
					</span>
				)}
			</button>

			{open && (
				<div
					ref={panelRef}
					role="dialog"
					aria-label="Notifications"
					aria-modal="true"
					className="absolute right-0 top-full mt-3 w-80 glass border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2"
				>
					<div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
						<h3 className="text-sm font-black uppercase tracking-widest text-white/80">
							Notifications
						</h3>
						{unreadCount > 0 && (
							<button
								type="button"
								className="text-xs text-brand-cyan hover:underline font-bold"
								onClick={() => void handleMarkAllRead()}
							>
								Mark all read
							</button>
						)}
					</div>

					<div className="max-h-80 overflow-y-auto">
						{notifications.length === 0 ? (
							<p className="text-center text-white/30 text-sm py-10 px-5">
								No notifications yet
							</p>
						) : (
							notifications.map((notification) => (
								<button
									key={notification.id}
									type="button"
									onClick={() => void handleNotificationClick(notification)}
									className={`w-full text-left px-5 py-4 border-b border-white/5 hover:bg-white/5 transition-colors ${
										!notification.is_read ? "bg-brand-cyan/5" : ""
									}`}
								>
									<div className="flex items-start gap-3">
										{!notification.is_read && (
											<span className="mt-1.5 w-2 h-2 rounded-full bg-brand-cyan shrink-0" />
										)}
										<div className={!notification.is_read ? "" : "pl-5"}>
											<p className="text-sm font-semibold text-white leading-snug">
												{notification.message}
											</p>
											<p className="text-[11px] text-white/30 mt-1">
												{new Date(notification.created_at).toLocaleString(
													undefined,
													{
														month: "short",
														day: "numeric",
														hour: "2-digit",
														minute: "2-digit",
													},
												)}
											</p>
										</div>
									</div>
								</button>
							))
						)}
					</div>
				</div>
			)}
		</div>
	)
}
