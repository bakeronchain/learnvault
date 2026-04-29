import { type ReactNode, useEffect, useMemo, useState } from "react"
import { useImpactMetrics } from "../hooks/useImpactMetrics"
import { useUpsertScholarRegion } from "../hooks/useSponsors"
import { useWallet } from "../hooks/useWallet"

function formatLargeNumber(value: number): string {
	if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
	if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
	return Math.round(value).toString()
}

function parseNumericString(value: string): number {
	const parsed = Number(value)
	if (!Number.isFinite(parsed)) return 0
	return parsed
}

function AnimatedCounter({
	value,
	suffix = "",
	durationMs = 900,
}: {
	value: number
	suffix?: string
	durationMs?: number
}) {
	const [displayValue, setDisplayValue] = useState(0)

	useEffect(() => {
		let frame = 0
		const startedAt = performance.now()
		const startValue = displayValue

		const tick = (now: number) => {
			const elapsed = now - startedAt
			const ratio = Math.min(1, elapsed / durationMs)
			const eased = 1 - (1 - ratio) * (1 - ratio)
			const next = startValue + (value - startValue) * eased
			setDisplayValue(next)
			if (ratio < 1) frame = requestAnimationFrame(tick)
		}

		frame = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(frame)
	}, [value])

	return (
		<span>
			{formatLargeNumber(displayValue)}
			{suffix}
		</span>
	)
}

export default function ImpactDashboard() {
	const { data, isLoading, error } = useImpactMetrics()
	const { address } = useWallet()
	const saveRegion = useUpsertScholarRegion()
	const [regionInput, setRegionInput] = useState("")
	const [embedCopied, setEmbedCopied] = useState(false)

	const maxCourseCount = useMemo(() => {
		const counts = data?.top_completed_courses.map((course) => course.completed_count) ?? []
		return counts.length > 0 ? Math.max(...counts, 1) : 1
	}, [data])

	const maxQuarterlyScholars = useMemo(() => {
		const values = data?.trends.quarterly.map((entry) => entry.scholars_funded) ?? []
		return values.length > 0 ? Math.max(...values, 1) : 1
	}, [data])

	const embedSnippet =
		typeof window !== "undefined"
			? `<iframe src="${window.location.origin}/impact/widget" width="360" height="180" style="border:0;border-radius:16px;overflow:hidden" loading="lazy"></iframe>`
			: `<iframe src="/impact/widget" width="360" height="180" style="border:0;border-radius:16px;overflow:hidden" loading="lazy"></iframe>`

	const handleCopyEmbed = async () => {
		if (!navigator.clipboard) return
		await navigator.clipboard.writeText(embedSnippet)
		setEmbedCopied(true)
		window.setTimeout(() => setEmbedCopied(false), 1600)
	}

	const handleSaveRegion = async () => {
		if (!address || !regionInput.trim()) return
		await saveRegion.mutateAsync({
			learner_address: address,
			country_region: regionInput.trim(),
		})
		setRegionInput("")
	}

	if (isLoading) {
		return (
			<div className="mx-auto max-w-6xl px-6 py-16 text-white">
				<p className="text-white/60">Loading impact dashboard...</p>
			</div>
		)
	}

	if (error || !data) {
		return (
			<div className="mx-auto max-w-6xl px-6 py-16 text-white">
				<p className="text-red-300">Unable to load impact metrics.</p>
			</div>
		)
	}

	const totalUsdc = parseNumericString(data.totals.total_usdc_disbursed)
	const totalLrn = parseNumericString(data.totals.total_lrn_minted)
	const completionRate = data.totals.average_course_completion_rate * 100

	return (
		<div className="mx-auto max-w-6xl px-6 py-12 text-white">
			<header className="mb-10">
				<p className="text-sm font-black uppercase tracking-[0.28em] text-brand-cyan/80">
					Public Metrics
				</p>
				<h1 className="mt-4 text-5xl font-black tracking-tight text-gradient">
					Scholarship Impact Dashboard
				</h1>
				<p className="mt-3 max-w-3xl text-white/60">
					Transparent funding, learner outcomes, and regional reach. All figures are public and updated continuously.
				</p>
			</header>

			<section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<MetricCard title="Total Scholars Funded">
					<AnimatedCounter value={data.totals.total_scholars_funded} />
				</MetricCard>
				<MetricCard title="Total USDC Disbursed">
					<AnimatedCounter value={totalUsdc} />
				</MetricCard>
				<MetricCard title="Avg Completion Rate">
					<AnimatedCounter value={completionRate} suffix="%" />
				</MetricCard>
				<MetricCard title="Total LRN Minted">
					<AnimatedCounter value={totalLrn} />
				</MetricCard>
			</section>

			<section className="mt-8 grid gap-6 lg:grid-cols-2">
				<div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
					<h2 className="text-2xl font-black">Top 5 Completed Courses</h2>
					<div className="mt-5 space-y-4">
						{data.top_completed_courses.map((course) => {
							const width = Math.max(
								8,
								Math.round((course.completed_count / maxCourseCount) * 100),
							)
							return (
								<div key={course.course_id}>
									<div className="mb-1 flex items-center justify-between text-sm">
										<span>{course.course_title}</span>
										<span className="text-white/60">{course.completed_count}</span>
									</div>
									<div className="h-2 rounded-full bg-white/10">
										<div
											className="h-2 rounded-full bg-linear-to-r from-brand-cyan to-brand-blue"
											style={{ width: `${width}%` }}
										/>
									</div>
								</div>
							)
						})}
					</div>
				</div>

				<div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
					<h2 className="text-2xl font-black">Countries / Regions Represented</h2>
					<p className="mt-2 text-white/60">
						{data.countries_regions.length} regions reported by scholars
					</p>
					<div className="mt-4 max-h-64 space-y-2 overflow-auto pr-1">
						{data.countries_regions.map((region) => (
							<div
								key={region.country_region}
								className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2"
							>
								<span>{region.country_region}</span>
								<span className="text-white/60">{region.scholar_count}</span>
							</div>
						))}
						{data.countries_regions.length === 0 && (
							<p className="text-white/50">No self-reported regions yet.</p>
						)}
					</div>
					{address && (
						<div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
							<p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
								Self-report your region
							</p>
							<div className="mt-3 flex flex-wrap gap-3">
								<input
									value={regionInput}
									onChange={(event) => setRegionInput(event.target.value)}
									placeholder="Country or region"
									className="flex-1 rounded-xl border border-white/15 bg-black/20 px-3 py-2"
								/>
								<button
									type="button"
									onClick={() => void handleSaveRegion()}
									className="rounded-xl bg-brand-cyan px-4 py-2 text-sm font-black uppercase tracking-widest text-black"
								>
									{saveRegion.isPending ? "Saving..." : "Save"}
								</button>
							</div>
						</div>
					)}
				</div>
			</section>

			<section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
				<h2 className="text-2xl font-black">Quarterly Trend</h2>
				<div className="mt-5 flex items-end gap-3 overflow-x-auto pb-2">
					{data.trends.quarterly.map((entry) => {
						const scholarsHeight = Math.max(
							12,
							Math.round((entry.scholars_funded / maxQuarterlyScholars) * 120),
						)
						return (
							<div key={entry.quarter} className="min-w-16 text-center">
								<div className="mx-auto flex h-36 items-end justify-center">
									<div
										className="w-8 rounded-t-xl bg-linear-to-t from-brand-blue to-brand-cyan"
										style={{ height: `${scholarsHeight}px` }}
										title={`${entry.scholars_funded} scholars`}
									/>
								</div>
								<p className="mt-2 text-xs text-white/60">{entry.quarter}</p>
								<p className="text-xs">{entry.scholars_funded}</p>
							</div>
						)
					})}
				</div>
				<p className="mt-3 text-sm text-white/60">
					Blue bars represent funded scholars each quarter.
				</p>
			</section>

			<section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
				<h2 className="text-2xl font-black">Embeddable Widget</h2>
				<p className="mt-2 text-white/60">
					Embed this metrics widget on partner websites.
				</p>
				<div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
					<code className="block overflow-auto whitespace-pre text-xs text-brand-cyan">
						{embedSnippet}
					</code>
					<button
						type="button"
						onClick={() => void handleCopyEmbed()}
						className="mt-3 rounded-xl border border-brand-cyan/40 px-4 py-2 text-xs font-black uppercase tracking-widest text-brand-cyan"
					>
						{embedCopied ? "Copied" : "Copy Embed Code"}
					</button>
				</div>
			</section>
		</div>
	)
}

function MetricCard({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
			<p className="text-xs font-black uppercase tracking-[0.2em] text-white/50">{title}</p>
			<p className="mt-3 text-3xl font-black text-brand-cyan">{children}</p>
		</div>
	)
}
