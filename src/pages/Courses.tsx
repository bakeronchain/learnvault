import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { CourseFilter } from "../components/CourseFilter"
import { courses } from "../data/courses"

const levelStyles: Record<(typeof courses)[number]["level"], string> = {
	Beginner: "bg-brand-emerald/20 text-brand-emerald border-brand-emerald/20",
	Intermediate: "bg-brand-purple/20 text-brand-purple border-brand-purple/20",
	Advanced: "bg-red-500/20 text-red-400 border-red-500/20",
}

/** Converts a track label to a URL-safe slug, e.g. "Smart Contracts" → "smart-contracts" */
function trackSlug(track: string): string {
	return track.toLowerCase().replace(/\s+/g, "-")
}

const Courses: React.FC = () => {
	const [searchParams, setSearchParams] = useSearchParams()

	// Local state for the search input so filtering is instant; URL is synced after debounce
	const [searchInput, setSearchInput] = useState(
		() => searchParams.get("q") ?? "",
	)

	const difficulty = searchParams.get("difficulty") ?? ""
	const track = searchParams.get("track") ?? ""

	// Debounce search input → URL param (300 ms)
	useEffect(() => {
		const t = setTimeout(() => {
			setSearchParams(
				(prev) => {
					const next = new URLSearchParams(prev)
					if (searchInput) next.set("q", searchInput)
					else next.delete("q")
					return next
				},
				{ replace: true },
			)
		}, 300)
		return () => clearTimeout(t)
	}, [searchInput, setSearchParams])

	const handleDifficultyChange = useCallback(
		(value: string) => {
			setSearchParams(
				(prev) => {
					const next = new URLSearchParams(prev)
					if (value) next.set("difficulty", value)
					else next.delete("difficulty")
					return next
				},
				{ replace: true },
			)
		},
		[setSearchParams],
	)

	const handleTrackChange = useCallback(
		(value: string) => {
			setSearchParams(
				(prev) => {
					const next = new URLSearchParams(prev)
					if (value) next.set("track", value)
					else next.delete("track")
					return next
				},
				{ replace: true },
			)
		},
		[setSearchParams],
	)

	const handleClear = useCallback(() => {
		setSearchInput("")
		setSearchParams({}, { replace: true })
	}, [setSearchParams])

	const hasActiveFilters = !!searchInput || !!difficulty || !!track

	const filtered = useMemo(() => {
		const q = searchInput.toLowerCase()
		return courses.filter((course) => {
			const matchesSearch =
				!q ||
				course.title.toLowerCase().includes(q) ||
				course.description.toLowerCase().includes(q)
			const matchesDifficulty =
				!difficulty || course.level.toLowerCase() === difficulty
			const matchesTrack = !track || trackSlug(course.track) === track
			return matchesSearch && matchesDifficulty && matchesTrack
		})
	}, [searchInput, difficulty, track])

	return (
		<div className="container mx-auto px-4 py-12">
			<header className="mb-12 text-center">
				<p className="text-sm uppercase tracking-[0.35em] text-brand-cyan/80 mb-4">
					Learning Tracks
				</p>
				<h1 className="text-4xl md:text-5xl font-bold mb-4 text-gradient">
					Choose a path and start with a focused first lesson.
				</h1>
				<p className="text-gray-400 text-lg max-w-3xl mx-auto leading-relaxed">
					Every LearnVault track is designed to move new learners from setup to
					hands-on progress with a clear first milestone.
				</p>
			</header>

			<CourseFilter
				search={searchInput}
				onSearchChange={setSearchInput}
				difficulty={difficulty}
				onDifficultyChange={handleDifficultyChange}
				track={track}
				onTrackChange={handleTrackChange}
				onClear={handleClear}
				hasActiveFilters={hasActiveFilters}
			/>

			{filtered.length === 0 ? (
				<div className="glass-card rounded-[2.5rem] border border-white/5 p-16 text-center">
					<p className="text-5xl mb-6">🔍</p>
					<h2 className="text-2xl font-black tracking-tight mb-3">
						No courses match your filters
					</h2>
					<p className="text-white/50 mb-8 max-w-sm mx-auto">
						Try a different search term or adjust the difficulty and track
						filters.
					</p>
					<button
						type="button"
						onClick={handleClear}
						className="px-6 py-2.5 rounded-full text-sm font-bold uppercase tracking-widest border border-brand-cyan/30 text-brand-cyan hover:bg-brand-cyan/10 transition-all"
					>
						Clear all filters
					</button>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
					{filtered.map((course) => (
						<article
							key={course.id}
							className="glass-card rounded-[2rem] flex flex-col h-full border border-white/10 overflow-hidden group"
						>
							<div
								className={`h-36 bg-linear-to-br ${course.accentClassName} border-b border-white/10`}
							/>
							<div className="p-6 flex flex-col h-full">
								<div className="flex items-center justify-between mb-4 gap-3">
									<span className="px-3 py-1 rounded-full text-xs font-semibold bg-brand-blue/20 text-brand-cyan border border-brand-cyan/20">
										{course.track}
									</span>
									<span
										className={`px-3 py-1 rounded-full text-xs font-semibold border ${levelStyles[course.level]}`}
									>
										{course.level}
									</span>
								</div>

								<h2 className="text-xl font-bold mb-3 group-hover:text-brand-cyan transition-colors duration-300">
									{course.title}
								</h2>
								<p className="text-white/55 text-sm leading-relaxed mb-5">
									{course.description}
								</p>

								<div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 mb-5">
									<p className="text-xs uppercase tracking-[0.25em] text-white/40">
										First lesson
									</p>
									<p className="mt-2 text-sm font-medium text-white/75">
										{course.firstLesson}
									</p>
								</div>

								<ul className="space-y-2 text-sm text-white/60 mb-6">
									{course.outcomes.map((outcome) => (
										<li
											key={outcome}
											className="rounded-xl bg-white/[0.03] px-3 py-2"
										>
											{outcome}
										</li>
									))}
								</ul>

								<div className="mt-auto flex items-center justify-between gap-4 text-sm text-gray-400">
									<span>{course.duration}</span>
									<Link
										to={`/learn?course=${course.id}`}
										className="iridescent-border px-4 py-2 rounded-xl font-semibold text-white hover:scale-105 transition-transform"
									>
										Preview track
									</Link>
								</div>
							</div>
						</article>
					))}
				</div>
			)}
		</div>
	)
}

export default Courses
