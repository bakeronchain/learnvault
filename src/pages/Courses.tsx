import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { CourseFilter } from "../components/CourseFilter"
import Pagination from "../components/Pagination"
import { CourseCardSkeleton } from "../components/skeletons/CourseCardSkeleton"
import { useCourses } from "../hooks/useCourses"
import { type CourseSummary } from "../types/courses"

const levelStyles: Record<CourseSummary["level"], string> = {
	Beginner: "bg-brand-emerald/20 text-brand-emerald border-brand-emerald/20",
	Intermediate: "bg-brand-purple/20 text-brand-purple border-brand-purple/20",
	Advanced: "bg-red-500/20 text-red-400 border-red-500/20",
}

const ITEMS_PER_PAGE = 4

/** Converts a track label to a URL-safe slug, e.g. "Smart Contracts" → "smart-contracts" */
function trackSlug(track: string): string {
	return track.toLowerCase().replace(/\s+/g, "-")
}

const Courses: React.FC = () => {
	const [searchParams, setSearchParams] = useSearchParams()
	const { courses, isLoading, error } = useCourses()

	// Local state for the search input so filtering is instant; URL is synced after debounce
	const [searchInput, setSearchInput] = useState(
		() => searchParams.get("q") ?? "",
	)

	const difficulty = searchParams.get("difficulty") ?? ""
	const track = searchParams.get("track") ?? ""
	const parsedPage = parseInt(searchParams.get("page") || "1", 10)
	const currentPage = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage

	// Debounce search input → URL param (300 ms)
	useEffect(() => {
		const t = setTimeout(() => {
			setSearchParams(
				(prev) => {
					const next = new URLSearchParams(prev)
					if (searchInput) next.set("q", searchInput)
					else next.delete("q")
					next.delete("page") // Reset to page 1 on search
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
					next.delete("page")
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
					next.delete("page")
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

	const handlePageChange = (newPage: number) => {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev)
				next.set("page", newPage.toString())
				return next
			},
			{ replace: false },
		)
		window.scrollTo({ top: 0, behavior: "smooth" })
	}

	const hasActiveFilters = !!searchInput || !!difficulty || !!track

	const filtered = useMemo(() => {
		const q = searchInput.toLowerCase()
		return courses.filter((course) => {
			const matchesSearch =
				!q ||
				course.title.toLowerCase().includes(q) ||
				course.description.toLowerCase().includes(q)
			const matchesDifficulty = !difficulty || course.difficulty === difficulty
			const matchesTrack = !track || trackSlug(course.track) === track
			return matchesSearch && matchesDifficulty && matchesTrack
		})
	}, [courses, searchInput, difficulty, track])

	const trackOptions = useMemo(() => {
		const seen = new Set<string>()
		const dynamicOptions = courses
			.filter((course) => {
				if (seen.has(course.trackKey)) return false
				seen.add(course.trackKey)
				return Boolean(course.trackKey)
			})
			.map((course) => ({
				label: course.track,
				value: trackSlug(course.track),
			}))

		return [{ label: "All Tracks", value: "" }, ...dynamicOptions]
	}, [courses])

	const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
	const safePage = Math.min(currentPage, totalPages)
	const startIndex = (safePage - 1) * ITEMS_PER_PAGE
	const paginatedCourses = filtered.slice(
		startIndex,
		startIndex + ITEMS_PER_PAGE,
	)

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
				trackOptions={trackOptions}
				onTrackChange={handleTrackChange}
				onClear={handleClear}
				hasActiveFilters={hasActiveFilters}
			/>

			{isLoading ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
					{[1, 2, 3, 4].map((i) => (
						<CourseCardSkeleton key={i} />
					))}
				</div>
			) : error ? (
				<div className="glass-card rounded-[2.5rem] border border-red-500/20 bg-red-500/10 p-12 text-center">
					<h2 className="text-2xl font-black tracking-tight mb-3">
						Couldn&apos;t load courses
					</h2>
					<p className="text-red-100/80 max-w-xl mx-auto">{error}</p>
				</div>
			) : filtered.length === 0 ? (
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
						className="w-full sm:w-auto px-6 py-2.5 rounded-full text-sm font-bold uppercase tracking-widest border border-brand-cyan/30 text-brand-cyan hover:bg-brand-cyan/10 transition-all"
					>
						Clear all filters
					</button>
				</div>
			) : (
				<>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
						{paginatedCourses.map((course) => (
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

									<div className="mt-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 text-sm text-gray-400">
										<span>{course.track}</span>
										<Link
											to={`/courses/${course.slug}/lessons/1`}
											className="iridescent-border w-full sm:w-auto text-center px-4 py-2 rounded-xl font-semibold text-white hover:scale-105 transition-transform"
										>
											Open course
										</Link>
									</div>
								</div>
							</article>
						))}
					</div>
					<div className="mt-12">
						<Pagination
							page={safePage}
							totalPages={totalPages}
							onPageChange={handlePageChange}
						/>
					</div>
				</>
			)}
		</div>
	)
}

export default Courses
