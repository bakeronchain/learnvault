import { Link } from "react-router-dom"
import { type DownloadRecord } from "../lib/offline-db"

interface DownloadedTracksProps {
	tracks: DownloadRecord[]
	onDelete: (trackSlug: string) => Promise<void>
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B"
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
	try {
		return new Date(iso).toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
		})
	} catch {
		return ""
	}
}

export function DownloadedTracks({ tracks, onDelete }: DownloadedTracksProps) {
	if (tracks.length === 0) return null

	return (
		<section aria-labelledby="downloaded-tracks-heading">
			<h2
				id="downloaded-tracks-heading"
				className="text-xl font-bold text-white mb-4 flex items-center gap-2"
			>
				<svg className="w-5 h-5 text-brand-cyan" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
					<path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
				</svg>
				Downloaded for Offline
			</h2>

			<ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{tracks.map((track) => (
					<li
						key={track.trackSlug}
						className="glass-card p-5 rounded-2xl border border-brand-cyan/10 flex flex-col"
					>
						<div className="flex items-start justify-between mb-2">
							<Link
								to={`/courses/${track.courseSlugs[0]}`}
								className="font-bold text-white text-sm hover:text-brand-cyan transition-colors"
							>
								{track.title}
							</Link>
							<button
								onClick={() => void onDelete(track.trackSlug)}
								className="text-red-400/50 hover:text-red-400 p-1 transition-colors shrink-0"
								aria-label={`Remove offline copy of ${track.title}`}
							>
								<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
								</svg>
							</button>
						</div>
						<div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest text-white/40 mt-auto">
							<span>{track.courseSlugs.length} course{track.courseSlugs.length !== 1 ? "s" : ""}</span>
							<span>·</span>
							<span>{formatBytes(track.totalSize)}</span>
							<span>·</span>
							<span>{formatDate(track.downloadedAt)}</span>
						</div>
					</li>
				))}
			</ul>
		</section>
	)
}
