import { useOnlineStatus } from "../hooks/useOnlineStatus"

export function OfflineIndicator() {
	const { isOnline, wasOffline } = useOnlineStatus()

	if (isOnline && !wasOffline) return null

	return (
		<div
			role="status"
			aria-live="polite"
			className={`fixed bottom-4 left-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-300 shadow-lg ${
				isOnline
					? "bg-brand-emerald/90 text-black translate-y-0"
					: "bg-amber-500/90 text-black translate-y-0"
			}`}
		>
			<span
				className={`w-2 h-2 rounded-full ${isOnline ? "bg-brand-emerald" : "bg-amber-400"} animate-pulse`}
			/>
			{isOnline ? "Back online — syncing…" : "Offline — progress will sync when connected"}
		</div>
	)
}
