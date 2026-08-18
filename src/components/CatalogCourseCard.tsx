import React, { useCallback } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useEnrollment } from "../hooks/useEnrollment"
import { type CourseSummary } from "../types/courses"
import BookmarkButton from "./BookmarkButton"
import CourseCategoryBadge from "./CourseCategoryBadge"
import SponsorLogosForTrack from "./SponsorLogosForTrack"

const levelStyles: Record<CourseSummary["level"], string> = {
	Beginner: "bg-brand-emerald/20 text-brand-emerald border-brand-emerald/20",
	Intermediate: "bg-brand-purple/20 text-brand-purple border-brand-purple/20",
	Advanced: "bg-red-500/20 text-red-400 border-red-500/20",
}

interface CatalogCourseCardProps {
	course: CourseSummary
	index: number
}

const CatalogCourseCard: React.FC<CatalogCourseCardProps> = ({
	course,
	index,
}) => {
	const navigate = useNavigate()
	const {
		isEnrolled,
		isChecking,
		isEnrolling,
		needsPersistence,
		error,
		firstLessonPath,
		enroll,
		retryPersistence,
	} = useEnrollment(course.slug)

	const handlePrimaryAction = useCallback(async () => {
		if (isEnrolled) {
			void navigate(firstLessonPath ?? `/courses/${course.slug}/lessons/1`)
			return
		}

		const lessonPath = needsPersistence
			? await retryPersistence()
			: await enroll()
		if (lessonPath) {
			void navigate(lessonPath)
		}
	}, [
		course.slug,
		enroll,
		firstLessonPath,
		isEnrolled,
		navigate,
		needsPersistence,
		retryPersistence,
	])

	const isPending = isChecking || isEnrolling
	const actionLabel = isEnrolled
		? "Continue"
		: needsPersistence
			? "Retry sync"
			: isChecking
				? "Checking..."
				: isEnrolling
					? "Enrolling..."
					: "Enroll now"

	return (
		<article className="glass-card relative flex h-full flex-col overflow-hidden rounded-4xl border border-white/10">
			{isEnrolled ? (
				<div className="absolute left-4 top-4 z-10 rounded-full border border-brand-cyan/40 bg-brand-cyan/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand-cyan">
					Enrolled
				</div>
			) : null}
			<div className="absolute right-4 top-4 z-10">
				<BookmarkButton courseId={course.id} />
			</div>
			<div
				className={`h-36 border-b border-white/10 bg-linear-to-br ${course.accentClassName}`}
			/>
			<div className="flex h-full flex-col p-6">
				<div className="mb-4 flex items-center justify-between gap-3">
					<CourseCategoryBadge category={course.track} />
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
				{course.ratingSummary && course.ratingSummary.count > 0 ? (
					<div className="mb-5 flex items-center gap-2 text-xs text-white/70">
						<span className="text-yellow-300">
							{"★".repeat(
								Math.max(
									1,
									Math.min(5, Math.round(course.ratingSummary.average)),
								),
							)}
						</span>
						<span>
							{course.ratingSummary.average.toFixed(1)} (
							{course.ratingSummary.count})
						</span>
					</div>
				) : null}

				<SponsorLogosForTrack track={course.track} compact />

				<div className="mt-auto flex flex-col items-stretch justify-between gap-4 text-sm text-gray-400 sm:flex-row sm:items-center">
					<span>{course.track}</span>
					{isEnrolled ? (
						<Link
							to={firstLessonPath ?? `/courses/${course.slug}/lessons/1`}
							id={index === 0 ? "course-card-0" : undefined}
							className="iridescent-border w-full rounded-xl px-4 py-2 text-center font-semibold text-white transition-transform hover:scale-105 sm:w-auto"
						>
							Continue
						</Link>
					) : (
						<button
							type="button"
							id={index === 0 ? "course-card-0" : undefined}
							onClick={() => {
								void handlePrimaryAction()
							}}
							disabled={isPending}
							aria-busy={isPending}
							aria-disabled={isPending}
							className="iridescent-border w-full rounded-xl px-4 py-2 text-center font-semibold text-white transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
						>
							{actionLabel}
						</button>
					)}
				</div>
				{error ? (
					<p className="mt-3 text-xs text-red-300" role="alert">
						{error}
					</p>
				) : null}
			</div>
		</article>
	)
}

export default CatalogCourseCard
