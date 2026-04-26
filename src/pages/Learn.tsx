import React, { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import {
	CourseCardSkeleton,
	NoCoursesEmptyState,
} from "../components/SkeletonLoader"
import { courses } from "../data/courses"
import storage from "../util/storage"

const ONBOARDING_TRACK_KEY = "learnvault:onboarding-track"

const Learn: React.FC = () => {
	const { t } = useTranslation()
	const [searchParams] = useSearchParams()
	const [isLoading, setIsLoading] = useState(true)
	const selectedCourseId =
		searchParams.get("course") ?? storage.getItem(ONBOARDING_TRACK_KEY, "safe")

	const selectedCourse = useMemo(
		() => courses.find((course) => course.id === selectedCourseId),
		[selectedCourseId],
	)

	useEffect(() => {
		const timer = setTimeout(() => setIsLoading(false), 900)
		return () => clearTimeout(timer)
	}, [])

	return (
		<div className="p-6 md:p-12 max-w-6xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
			<header className="mb-12 text-center">
				<p className="text-sm uppercase tracking-[0.35em] text-brand-cyan/80 mb-4">
					Learning Workspace
				</p>
				<h1 className="text-5xl md:text-6xl font-black mb-4 tracking-tighter text-gradient">
					{selectedCourse ? selectedCourse.title : t("pages.learn.title")}
				</h1>
				<p className="text-white/40 text-lg font-medium max-w-3xl mx-auto leading-relaxed">
					{selectedCourse ? selectedCourse.description : t("pages.learn.desc")}
				</p>
			</header>

			{isLoading ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
					{[1, 2, 3].map((i) => (
						<CourseCardSkeleton key={i} />
					))}
				</div>
			) : selectedCourse ? (
				<div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
					<section className="glass-card p-8 md:p-10 rounded-[2.5rem] border border-white/10">
						<div
							className={`h-44 rounded-[2rem] bg-linear-to-br ${selectedCourse.accentClassName} border border-white/10`}
						/>
						<div className="mt-8 flex flex-wrap items-center gap-3">
							<span className="px-3 py-1 rounded-full text-xs font-semibold bg-brand-blue/20 text-brand-cyan border border-brand-cyan/20">
								{selectedCourse.track}
							</span>
							<span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/8 text-white/70 border border-white/10">
								{selectedCourse.duration}
							</span>
						</div>
						<h2 className="mt-5 text-3xl font-black tracking-tight">
							Lesson 1
						</h2>
						<h3 className="mt-3 text-xl font-semibold text-white/85">
							{selectedCourse.firstLesson}
						</h3>
						<p className="mt-4 text-white/60 leading-relaxed max-w-2xl">
							Start here to build confidence with the key concepts, practical
							workflow, and vocabulary you&apos;ll need before moving into
							milestones and deeper protocol exercises.
						</p>
						<div className="mt-8 grid gap-3 sm:grid-cols-3">
							{selectedCourse.outcomes.map((outcome) => (
								<div
									key={outcome}
									className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4"
								>
									<p className="text-sm font-medium text-white/75">{outcome}</p>
								</div>
							))}
						</div>
					</section>

					<aside className="glass-card p-8 md:p-10 rounded-[2.5rem] border border-white/10">
						<p className="text-sm uppercase tracking-[0.35em] text-white/40">
							What to do next
						</p>
						<ul className="mt-6 space-y-4 text-white/65">
							<li className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
								Review the lesson prompt and vocabulary for this track.
							</li>
							<li className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
								Connect your understanding back to the course milestones on the
								home page.
							</li>
							<li className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
								Keep this track selected as your default launch point for the
								next session.
							</li>
						</ul>
					</aside>
				</div>
			) : (
				<NoCoursesEmptyState />
			)}
		</div>
	)
}

export default Learn
