import { type LucideIcon } from "lucide-react"
import { Link } from "react-router-dom"

interface EmptyStateProps {
	icon?: LucideIcon | string
	title: string
	description?: string
	ctaLabel?: string
	/** Internal route — uses React Router <Link> (preferred for in-app navigation) */
	ctaTo?: string
	/** External URL — uses a plain <a> tag */
	ctaHref?: string
	onCtaClick?: () => void
}

export function EmptyState({
	icon: Icon,
	title,
	description,
	ctaLabel,
	ctaTo,
	ctaHref,
	onCtaClick,
}: EmptyStateProps) {
	const isIconString = typeof Icon === "string"

	return (
		<div className="flex flex-col items-center justify-center py-16 text-center">
			{Icon && (
				isIconString ? (
					<div className="text-4xl mb-4">{Icon}</div>
				) : (
					<Icon className="h-12 w-12 text-muted-foreground mb-4" />
				)
			)}

			<h3 className="text-lg font-semibold">{title}</h3>

			{description && (
				<p className="text-sm text-muted-foreground mt-1 max-w-sm">
					{description}
				</p>
			)}

			{(ctaLabel || ctaTo || ctaHref || onCtaClick) && (
				<div className="mt-6">
					{onCtaClick ? (
						<button
							onClick={onCtaClick}
							aria-label={ctaLabel}
							className="px-6 py-3 bg-brand-cyan text-black font-bold rounded-xl shadow-md min-h-[44px] min-w-[160px] active:scale-95 hover:scale-105 transition-all"
						>
							{ctaLabel}
						</button>
					) : ctaTo ? (
						<Link
							to={ctaTo}
							className="inline-flex items-center justify-center px-6 py-3 bg-brand-cyan text-black font-bold rounded-xl shadow-md min-h-[44px] min-w-[160px] active:scale-95 hover:scale-105 transition-all"
						>
							{ctaLabel}
						</Link>
					) : (
						<a
							href={ctaHref}
							className="inline-flex items-center justify-center px-6 py-3 bg-brand-cyan text-black font-bold rounded-xl shadow-md min-h-[44px] min-w-[160px] active:scale-95 hover:scale-105 transition-all"
						>
							{ctaLabel}
						</a>
					)}
				</div>
			)}
		</div>
	)
}
