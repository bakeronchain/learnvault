import React from "react"
import { Link, useNavigate } from "react-router-dom"

import { useBookmarks } from "../hooks/useBookmarks"
import { useCourses } from "../hooks/useCourses"
import CourseCard from "./CourseCard"

/**
 * "My Bookmarks" section for the Dashboard. Shows courses the learner
 * has hearted for later. Hidden entirely when the wallet isn't connected.
 */
const MyBookmarks: React.FC = () => {
	const { bookmarks, isLoading: isLoadingBookmarks, address } = useBookmarks()
	const { courses, isLoading: isLoadingCourses } = useCourses()
	const navigate = useNavigate()

	if (!address) return null

	const bookmarkedIds = new Set(bookmarks.map((b) => b.course_id))
	const bookmarkedCourses = courses.filter((c) => bookmarkedIds.has(c.id))

	const isLoading = isLoadingBookmarks || isLoadingCourses

	return (
		<section className="space-y-6" aria-label="My bookmarks">
			<h2 className="text-xl sm:text-2xl md:text-3xl font-black flex items-center gap-3">
				<span className="text-2xl sm:text-3xl" aria-hidden="true">
					💙
				</span>
				My Bookmarks
			</h2>

			{isLoading ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 items-start">
					{[1, 2].map((i) => (
						<div
							key={i}
							className="glass-card p-6 rounded-[2.5rem] border border-white/10 bg-white/5 animate-pulse min-h-80"
						/>
					))}
				</div>
			) : bookmarkedCourses.length > 0 ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 items-start">
					{bookmarkedCourses.map((course) => (
						<CourseCard
							key={course.id}
							id={course.id}
							title={course.title}
							description={course.description}
							difficulty={
								course.difficulty as "beginner" | "intermediate" | "advanced"
							}
							estimatedHours={0}
							lrnReward={0}
							lessonCount={0}
							coverImage={course.coverImage ?? undefined}
							onEnroll={() =>
								navigate(`/courses?highlight=${encodeURIComponent(course.id)}`)
							}
						/>
					))}
				</div>
			) : (
				<div className="glass-card p-8 sm:p-12 text-center rounded-2xl border border-white/10">
					<p className="text-white/50 mb-4 text-sm sm:text-base">
						You haven't bookmarked any courses yet. Tap the heart on a course to
						save it for later.
					</p>
					<Link
						to="/courses"
						className="inline-block w-full sm:w-auto text-center iridescent-border px-6 sm:px-8 py-3 rounded-xl font-bold transition-all hover:scale-105 active:scale-95"
					>
						<span className="relative z-10">Browse courses &rarr;</span>
					</Link>
				</div>
			)}
		</section>
	)
}

export default MyBookmarks
