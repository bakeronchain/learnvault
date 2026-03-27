import React, { useEffect, useRef, useState } from "react"

interface CourseProgressBarProps {
	completed: number
	total: number
	size?: "sm" | "md" | "lg"
	animate?: boolean
	className?: string
}

const DURATION = 800 // ms

function easeOutCubic(t: number) {
	return 1 - Math.pow(1 - t, 3)
}

export const CourseProgressBar: React.FC<CourseProgressBarProps> = ({
	completed,
	total,
	size = "md",
	animate = true,
	className = "",
}) => {
	const isLoading = total === 0 || total == null
	const pct = isLoading
		? 0
		: Math.min(100, Math.round((completed / total) * 100))
	const isDone = !isLoading && completed >= total

	const prevPctRef = useRef(animate ? 0 : pct)
	const [displayPct, setDisplayPct] = useState(animate ? 0 : pct)
	const rafRef = useRef<number | null>(null)

	useEffect(() => {
		if (!animate || isLoading) {
			setDisplayPct(pct)
			prevPctRef.current = pct
			return
		}

		const from = prevPctRef.current
		const to = pct
		if (from === to) return

		let startTs: number | null = null

		const tick = (ts: number) => {
			if (startTs === null) startTs = ts
			const elapsed = ts - startTs
			const progress = Math.min(elapsed / DURATION, 1)
			const val = Math.round(from + (to - from) * easeOutCubic(progress))
			setDisplayPct(val)
			if (progress < 1) {
				rafRef.current = requestAnimationFrame(tick)
			} else {
				prevPctRef.current = to
			}
		}

		if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
		rafRef.current = requestAnimationFrame(tick)

		return () => {
			if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
		}
	}, [pct, animate, isLoading])

	const trackHeight = size === "sm" ? "h-2" : size === "md" ? "h-2.5" : "h-3.5"

	// Minimum 10px labels everywhere (WCAG-safe on mobile)
	const labelCls = size === "lg" ? "text-[11px]" : "text-[10px]"
	const countCls = size === "lg" ? "text-xs" : "text-[10px]"

	const fillStyle: React.CSSProperties = {
		width: `${displayPct}%`,
		background: isDone
			? "var(--color-emerald, #34d399)"
			: "linear-gradient(90deg, var(--color-cyan, #22d3ee), var(--color-emerald, #34d399))",
		boxShadow: isDone ? "0 0 14px 2px rgba(52,211,153,0.4)" : undefined,
		position: "relative",
		overflow: "hidden",
		height: "100%",
		borderRadius: 9999,
	}

	if (isLoading) {
		return (
			<div
				className={`w-full ${className}`}
				aria-busy="true"
				aria-label="Loading progress"
			>
				<style>{`
					@keyframes progressSkeleton {
						0%   { transform: translateX(-100%); opacity: 0.4; }
						50%  { opacity: 1; }
						100% { transform: translateX(350%); opacity: 0.4; }
					}
				`}</style>
				<div className="flex justify-between mb-2">
					<span
						className={`${labelCls} font-black uppercase tracking-widest text-white/30`}
					>
						Progress
					</span>
					<span className={`${labelCls} font-black text-white/20`}>—/—</span>
				</div>
				<div
					className={`w-full ${trackHeight} rounded-full overflow-hidden bg-white/[0.06]`}
				>
					<div
						className="h-full rounded-full bg-white/10"
						style={{
							width: "40%",
							animation: "progressSkeleton 1.6s ease-in-out infinite",
						}}
					/>
				</div>
			</div>
		)
	}

	// ── shimmer: scoped keyframe, no tailwind.config needed ────────
	const shimmerStyle: React.CSSProperties = {
		position: "absolute",
		inset: 0,
		background:
			"linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.22) 50%, transparent 100%)",
		animation: "pbShimmer 2.2s ease-in-out infinite",
	}

	return (
		<div className={`w-full select-none ${className}`}>
			<style>{`
				@keyframes pbShimmer {
					0%   { transform: translateX(-100%); }
					100% { transform: translateX(200%); }
				}
			`}</style>

			{/* ── Labels row ── */}
			<div className="flex items-center justify-between mb-2 gap-2">
				<span
					className={`${labelCls} font-black uppercase tracking-widest text-white/40 shrink-0`}
				>
					Progress
				</span>

				{/* Right side — wraps on very narrow cards without clipping */}
				<div className="flex items-center gap-2 min-w-0 flex-wrap justify-end">
					{isDone && (
						<span
							className={`
								${labelCls} font-black uppercase tracking-widest shrink-0
								flex items-center gap-1 rounded-full
								bg-brand-emerald/15 border border-brand-emerald/40 text-brand-emerald
								${size === "lg" ? "px-3 py-1" : "px-2 py-0.5"}
							`}
						>
							<svg
								viewBox="0 0 12 12"
								className="w-2.5 h-2.5 shrink-0"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.2"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<polyline points="1.5,6.5 4.5,9.5 10.5,2.5" />
							</svg>
							Complete
						</span>
					)}
					<span
						className={`
							${countCls} font-black tabular-nums shrink-0
							${isDone ? "text-brand-emerald" : "text-white/60"}
						`}
					>
						{completed}/{total}
					</span>
				</div>
			</div>

			{/* ── Track ── */}
			<div
				className={`w-full ${trackHeight} rounded-full bg-white/[0.06] border border-white/[0.04] overflow-hidden`}
				role="progressbar"
				aria-valuenow={completed}
				aria-valuemin={0}
				aria-valuemax={total}
				aria-label={`${completed} of ${total} milestones completed`}
			>
				<div style={fillStyle}>
					{!isDone && displayPct > 4 && (
						<span style={shimmerStyle} aria-hidden="true" />
					)}
				</div>
			</div>

			{/* ── Percentage — md and lg only ── */}
			{size !== "sm" && (
				<p
					className={`mt-1.5 text-right ${countCls} font-black tabular-nums tracking-widest ${
						isDone ? "text-brand-emerald" : "text-white/25"
					}`}
					aria-hidden="true"
				>
					{displayPct}%
				</p>
			)}
		</div>
	)
}

export default CourseProgressBar
