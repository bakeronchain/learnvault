import { BookOpen } from "lucide-react"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import CatalogCourseCard from "../components/CatalogCourseCard"
import { ContentLanguageSelector } from "../components/ContentLanguageSelector"
import { CourseFilter } from "../components/CourseFilter"
import Pagination from "../components/Pagination"
import RecommendationsCarousel from "../components/RecommendationsCarousel"
import { CourseCardSkeleton } from "../components/skeletons/CourseCardSkeleton"
import { EmptyState } from "../components/states/emptyState"
import { ErrorState } from "../components/states/errorState"
import { useCourses } from "../hooks/useCourses"
import { useContentLanguage } from "../providers/ContentLanguageProvider"

const ITEMS_PER_PAGE = 4

function trackSlug(track: string): string {
	return track.toLowerCase().replace(/\s+/g, "-")
}

const Courses: React.FC = () => {
	const [searchParams, setSearchParams] = useSearchParams()
	const { contentLanguage } = useContentLanguage()
	const { courses, isLoading, error } = useCourses(contentLanguage)

	const [searchInput, setSearchInput] = useState(
		() => searchParams.get("q") ?? "",
	)

	const difficulty = searchParams.get("difficulty") ?? ""
	const track = searchParams.get("track") ?? ""
	const language = searchParams.get("lang") ?? ""
	const parsedPage = parseInt(searchParams.get("page") || "1", 10)
	const currentPage =
		Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage

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

	const handleLanguageChange = useCallback(
		(value: string) => {
			setSearchParams(
				(prev) => {
					const next = new URLSearchParams(prev)
					if (value) next.set("lang", value)
					else next.delete("lang")
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

	const hasActiveFilters = Boolean(
		searchInput || difficulty || track || language,
	)

	const filtered = useMemo(() => {
		const q = searchInput.toLowerCase()
		return courses.filter((course) => {
			const matchesSearch =
				!q ||
				course.title.toLowerCase().includes(q) ||
				course.description.toLowerCase().includes(q)
			const matchesDifficulty = !difficulty || course.difficulty === difficulty
			const matchesTrack = !track || trackSlug(course.track) === track
			const matchesLanguage =
				!language || (course.availableLanguages ?? []).includes(language)
			return (
				matchesSearch && matchesDifficulty && matchesTrack && matchesLanguage
			)
		})
	}, [courses, searchInput, difficulty, track, language])

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
	const paginatedCourses = filtered.slice(
		startIndex,
		startIndex + ITEMS_PER_PAGE,
	)

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
				<div className="mt-6 flex justify-center">
					<ContentLanguageSelector />
				</div>
			</header>

			<div className="mb-12">
				<RecommendationsCarousel />
			</div>

			<CourseFilter
				search={searchInput}
				onSearchChange={setSearchInput}
				difficulty={difficulty}
				onDifficultyChange={handleDifficultyChange}
				track={track}
				trackOptions={trackOptions}
				onTrackChange={handleTrackChange}
				language={language}
				onLanguageChange={handleLanguageChange}
				onClear={handleClear}
				hasActiveFilters={hasActiveFilters}
			/>

			{isLoading ? (
				<div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }, (_, i) => i + 1).map((index) => (
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
				<EmptyState
					icon="🔎"
					title="No courses match your filters"
					description="Try a different search term or adjust the difficulty and track filters."
					ctaLabel="Clear all filters"
					onCtaClick={handleClear}
				/>
			) : (
				<>
					<div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{paginatedCourses.map((course, index) => (
							<CatalogCourseCard
								key={course.id}
								course={course}
								index={index}
							/>
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
