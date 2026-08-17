import { useState } from "react"

interface DownloadTrackButtonProps {
	trackSlug: string
	trackTitle: string
	courseSlugs: string[]
	isDownloaded: boolean
	progress: {
		trackSlug: string
		bytesDownloaded: number
		totalBytes: number
		stage: string
		error?: string
	} | null
	onDownload: (
		trackSlug: string,
		trackTitle: string,
		courseSlugs: string[],
		fetchCourseDetail: (slug: string) => Promise<Response>,
	) => Promise<void>
	onDelete: (trackSlug: string) => Promise<void>
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B"
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function fetchCourseDetail(slug: string): Promise<Response> {
	return fetch(`/api/courses/${slug}`, {
		headers: { "Content-Type": "application/json" },
	})
}

export function DownloadTrackButton({
	trackSlug,
	trackTitle,
	courseSlugs,
	isDownloaded,
	progress,
	onDownload,
	onDelete,
}: DownloadTrackButtonProps) {
	const [confirming, setConfirming] = useState(false)

	const isActive = progress && progress.trackSlug === trackSlug
	const isDownloading =
		isActive && (progress.stage === "estimating" || progress.stage === "downloading")
	const downloadDone = isActive && progress.stage === "done"
	const downloadError = isActive && progress.stage === "error"
	const percent =
		isActive && progress.totalBytes > 0
		? Math.round((progress.bytesDownloaded / progress.totalBytes) * 100)
		: 0

	if (isDownloaded && !downloadDone) {
		return (
			<div className="flex items-center gap-2">
				<span className="text-[9px] font-black uppercase tracking-widest text-brand-emerald border border-brand-emerald/30 px-2 py-1 rounded-lg flex items-center gap-1">
					<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					Downloaded
				</span>
				<button
					onClick={() => void onDelete(trackSlug)}
					className="text-[9px] font-black uppercase tracking-widest text-red-400/70 hover:text-red-400 border border-red-400/20 hover:border-red-400/40 px-2 py-1 rounded-lg transition-colors"
					aria-label={`Delete offline copy of ${trackTitle}`}
				>
					Remove
				</button>
			</div>
		)
	}

	if (isDownloading) {
		return (
			<div className="w-full">
				<div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-white/50 mb-1">
					<span>
						{progress.stage === "estimating" ? "Estimating…" : "Downloading…"}
					</span>
					<span>{percent}%</span>
				</div>
				<div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
					<div
						className="h-full bg-brand-cyan rounded-full transition-all duration-300"
						style={{ width: `${percent}%` }}
					/>
				</div>
				{progress.totalBytes > 0 && (
					<p className="text-[8px] text-white/30 mt-1">
						~{formatBytes(progress.totalBytes)} total
					</p>
				)}
			</div>
		)
	}

	if (downloadDone) {
		return (
			<span className="text-[9px] font-black uppercase tracking-widest text-brand-emerald border border-brand-emerald/30 px-2 py-1 rounded-lg">
				Saved
			</span>
		)
	}

	if (downloadError) {
		return (
			<div className="text-center">
				<p className="text-[9px] text-red-400 mb-1">{progress.error}</p>
				<button
					onClick={() => setConfirming(false)}
					className="text-[9px] font-black uppercase tracking-widest text-brand-cyan border border-brand-cyan/30 px-2 py-1 rounded-lg hover:bg-brand-cyan/10 transition-colors"
				>
					Retry
				</button>
			</div>
		)
	}

	if (confirming) {
		return (
			<div className="text-center">
				<p className="text-[9px] text-white/50 mb-2">
					Download {courseSlugs.length} course{courseSlugs.length !== 1 ? "s" : ""} for offline use?
				</p>
				<div className="flex gap-2 justify-center">
					<button
						onClick={() => {
							void onDownload(trackSlug, trackTitle, courseSlugs, fetchCourseDetail)
							setConfirming(false)
						}}
						className="text-[9px] font-black uppercase tracking-widest bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan px-3 py-1 rounded-lg hover:bg-brand-cyan/30 transition-colors"
					>
						Confirm
					</button>
					<button
						onClick={() => setConfirming(false)}
						className="text-[9px] font-black uppercase tracking-widest text-white/40 border border-white/10 px-3 py-1 rounded-lg hover:text-white/60 transition-colors"
					>
						Cancel
					</button>
				</div>
			</div>
		)
	}

	return (
		<button
			onClick={() => setConfirming(true)}
			disabled={!navigator.onLine}
			className="text-[9px] font-black uppercase tracking-widest text-brand-cyan border border-brand-cyan/30 px-2 py-1 rounded-lg hover:bg-brand-cyan/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
			aria-label={`Download ${trackTitle} for offline use`}
		>
			<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
			</svg>
			Download
		</button>
	)
}
