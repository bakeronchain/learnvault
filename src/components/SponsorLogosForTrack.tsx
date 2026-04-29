import { useMemo } from "react"
import { useTrackSponsorLogos } from "../hooks/useSponsors"

type SponsorLogosForTrackProps = {
	track: string
	compact?: boolean
}

export default function SponsorLogosForTrack({
	track,
	compact = false,
}: SponsorLogosForTrackProps) {
	const { data: sponsors = [], isLoading } = useTrackSponsorLogos(track)
	const visibleSponsors = useMemo(
		() => sponsors.filter((sponsor) => Boolean(sponsor.logo_url)).slice(0, compact ? 4 : 8),
		[sponsors, compact],
	)

	if (isLoading || visibleSponsors.length === 0) return null

	return (
		<section
			className={
				compact
					? "mt-3 flex items-center gap-3"
					: "mt-8 rounded-3xl border border-white/10 bg-white/[0.02] px-5 py-4"
			}
		>
			{!compact && (
				<p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-white/50">
					Track Sponsors
				</p>
			)}
			<div className="flex flex-wrap items-center gap-3">
				{visibleSponsors.map((sponsor) => (
					<a
						key={sponsor.wallet_address}
						href={sponsor.website || "#"}
						target={sponsor.website ? "_blank" : undefined}
						rel={sponsor.website ? "noreferrer" : undefined}
						className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/90 p-1 transition-transform hover:scale-105"
						title={sponsor.name}
					>
						{typeof sponsor.logo_url === "string" ? (
							<img
								src={sponsor.logo_url}
								alt={sponsor.name}
								className="h-full w-full object-contain"
							/>
						) : (
							<span className="text-[10px] font-black uppercase text-slate-700">
								{sponsor.name.slice(0, 2)}
							</span>
						)}
					</a>
				))}
			</div>
		</section>
	)
}
