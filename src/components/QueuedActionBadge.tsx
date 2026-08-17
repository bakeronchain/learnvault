interface QueuedActionBadgeProps {
	status: "queued" | "synced" | "failed"
	errorMessage?: string
}

export function QueuedActionBadge({ status, errorMessage }: QueuedActionBadgeProps) {
	if (status === "synced") {
		return (
			<span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-brand-emerald">
				<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
					<path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				Synced
			</span>
		)
	}

	if (status === "failed") {
		return (
			<span
				className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-red-400"
				title={errorMessage ?? "Sync failed — will retry"}
			>
				<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
					<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
				</svg>
				Failed
			</span>
		)
	}

	return (
		<span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-amber-400">
			<span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
			Queued
		</span>
	)
}
