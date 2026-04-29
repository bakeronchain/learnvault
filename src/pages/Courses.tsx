import { BookOpen } from "lucide-react"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import BookmarkButton from "../components/BookmarkButton"
import { CourseFilter } from "../components/CourseFilter"
import Pagination from "../components/Pagination"
import SponsorLogosForTrack from "../components/SponsorLogosForTrack"
import { CourseCardSkeleton } from "../components/skeletons/CourseCardSkeleton"
import { EmptyState } from "../components/states/emptyState"
import { ErrorState } from "../components/states/errorState"
import { useCourses } from "../hooks/useCourses"
import { type CourseSummary } from "../types/courses"

const levelStyles: Record<CourseSummary["level"], string> = {
	Beginner: "bg-brand-emerald/20 text-brand-emerald border-brand-emerald/20",
	Intermediate: "bg-brand-purple/20 text-brand-purple border-brand-purple/20",
	Advanced: "bg-red-500/20 text-red-400 border-red-500/20",
}

const ITEMS_PER_PAGE = 4

function trackSlug(track: string): string {
	return track.toLowerCase().replace(/\s+/g, "-")
}

const Courses: React.FC = () => {
	const [searchParams, setSearchParams] = useSearchParams()
	const { courses, isLoading, error } = useCourses()

	const [searchInput, setSearchInput] = useState(
		() => searchParams.get("q") ?? "",
	)

	const difficulty = searchParams.get("difficulty") ?? ""
	const track = searchParams.get("track") ?? ""
	const parsedPage = parseInt(searchParams.get("page") || "1", 10)
	const currentPage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage

	useEffect(() => {
		const timer = setTimeout(() => {
			setSearchParams(
				(prev) => {
					const next = new URLSearchParams(prev)
					if (searchInput) next.set("q", searchInput)
					else next.delete("q")
					next.delete("page")
					return next
				},
				{ replace: true },
			)
		}, 300)

		return () => clearTimeout(timer)
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
				next.set("page", String(newPage))
				return next
			},
			{ replace: false },
		)
		window.scrollTo({ top: 0, behavior: "smooth" })
	}

	const hasActiveFilters = Boolean(searchInput || difficulty || track)

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
		const options = courses
			.filter((course) => {
				if (seen.has(course.trackKey)) return false
				seen.add(course.trackKey)
				return Boolean(course.trackKey)
			})
			.map((course) => ({
				label: course.track,
				value: trackSlug(course.track),
			}))

		return [{ label: "All Tracks", value: "" }, ...options]
	}, [courses])

	const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
	const safePage = Math.min(currentPage, totalPages)
	const startIndex = (safePage - 1) * ITEMS_PER_PAGE
	const paginatedCourses = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE)

	return (
		<div className="container mx-auto px-4 py-12">
			<header className="mb-12 text-center">
				<p className="mb-4 text-sm uppercase tracking-[0.35em] text-brand-cyan/80">
					Learning Tracks
				</p>
				<h1 className="mb-4 text-4xl font-bold text-gradient md:text-5xl">
					Choose a path and start with a focused first lesson.
				</h1>
				<p className="mx-auto max-w-3xl text-lg leading-relaxed text-gray-400">
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
				<div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{[1, 2, 3, 4].map((index) => (
						<CourseCardSkeleton key={index} />
					))}
				</div>
			) : error ? (
				<ErrorState message={error} onRetry={() => window.location.reload()} />
			) : courses.length === 0 ? (
				<EmptyState
					icon={BookOpen}
					title="No courses available"
					description="There are no courses yet. Check back soon!"
				/>
			) : filtered.length === 0 ? (
				<div className="glass-card rounded-[2.5rem] border border-white/5 p-16 text-center">
					<p className="mb-6 text-5xl">Search</p>
					<h2 className="mb-3 text-2xl font-black tracking-tight">
						No courses match your filters
					</h2>
					<p className="mx-auto mb-8 max-w-sm text-white/50">
						Try a different search term or adjust the difficulty and track filters.
					</p>
					<button
						type="button"
						onClick={handleClear}
						className="w-full rounded-full border border-brand-cyan/30 px-6 py-2.5 text-sm font-bold uppercase tracking-widest text-brand-cyan transition-all hover:bg-brand-cyan/10 sm:w-auto"
					>
						Clear all filters
					</button>
				</div>
			) : (
				<>
					<div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{paginatedCourses.map((course, index) => (
							<article
								key={course.id}
								className="glass-card relative flex h-full flex-col overflow-hidden rounded-4xl border border-white/10"
							>
								<div className="absolute right-4 top-4 z-10">
									<BookmarkButton courseId={course.id} />
								</div>
								<div
									className={`h-36 border-b border-white/10 bg-linear-to-br ${course.accentClassName}`}
								/>
								<div className="flex h-full flex-col p-6">
									<div className="mb-4 flex items-center justify-between gap-3">
										<span className="rounded-full border border-brand-cyan/20 bg-brand-blue/20 px-3 py-1 text-xs font-semibold text-brand-cyan">
											{course.track}
										</span>
										<span
											className={`rounded-full border px-3 py-1 text-xs font-semibold ${levelStyles[course.level]}`}
										>
											{course.level}
										</span>
									</div>

									<h2 className="mb-3 text-xl font-bold transition-colors duration-300 group-hover:text-brand-cyan">
										{course.title}
									</h2>
									<p className="mb-5 text-sm leading-relaxed text-white/55">
										{course.description}
									</p>

									<SponsorLogosForTrack track={course.track} compact />

									<div className="mt-auto flex flex-col items-stretch justify-between gap-4 text-sm text-gray-400 sm:flex-row sm:items-center">
										<span>{course.track}</span>
										<Link
											to={`/courses/${course.slug}/lessons/1`}
											id={index === 0 ? "course-card-0" : undefined}
											className="iridescent-border w-full rounded-xl px-4 py-2 text-center font-semibold text-white transition-transform hover:scale-105 sm:w-auto"
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
