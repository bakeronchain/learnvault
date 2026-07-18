import React from "react"
import { Link } from "react-router-dom"
import {
	DashboardStatsSkeleton,
	NoCoursesEmptyState,
} from "../components/SkeletonLoader"
import { useEnrolledCourses } from "../hooks/useCourses"

export default function Dashboard() {
	const { enrolledCourses, isLoading } = useEnrolledCourses()

	// A course is "in progress" when it has at least one milestone remaining,
	// or when the total is unknown (totalCount === 0).
	const inProgressCourses = enrolledCourses.filter(
		(c) => c.completedCount < c.totalCount || c.totalCount === 0,
	)

	return (
		<div className="container mx-auto px-4 py-12 max-w-5xl">
			<h1 className="text-3xl font-black tracking-tight text-white mb-10">
				Dashboard
			</h1>

			<section aria-labelledby="courses-in-progress-heading">
				<h2
					id="courses-in-progress-heading"
					className="text-xl font-bold text-white mb-6"
				>
					Courses in Progress
				</h2>

				{isLoading ? (
					<DashboardStatsSkeleton />
				) : inProgressCourses.length === 0 ? (
					<NoCoursesEmptyState />
				) : (
					<ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
						{inProgressCourses.map((course) => (
							<li key={course.courseId}>
								<Link
									to={`/courses/${course.courseId}`}
									className="glass-card block p-6 rounded-[2rem] border border-white/10 hover:border-brand-cyan/30 transition-colors"
								>
									<h3 className="text-base font-bold text-white mb-4 leading-snug">
										{course.title}
									</h3>

									<div className="flex justify-between text-sm text-white/60 mb-2 font-medium">
										<span>Progress</span>
										<span>
											{course.completedCount} of {course.totalCount}
										</span>
									</div>

									<div
										className="h-2 w-full bg-white/10 rounded-full overflow-hidden"
										role="progressbar"
										aria-valuenow={course.progressPercent}
										aria-valuemin={0}
										aria-valuemax={100}
										aria-label={`${course.title} progress: ${course.progressPercent}%`}
									>
										<div
											className="h-full bg-brand-cyan rounded-full transition-all duration-500 ease-out"
											style={{ width: `${course.progressPercent}%` }}
										/>
									</div>

									<p className="mt-2 text-right text-xs text-white/40 font-medium">
										{course.progressPercent}%
									</p>
								</Link>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	)
}
