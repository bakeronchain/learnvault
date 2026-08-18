import React from "react"
import { Link } from "react-router-dom"
import BookmarkButton from "./BookmarkButton"
import CourseCategoryBadge from "./CourseCategoryBadge"

interface CourseCardProps {
	id: string
	title: string
	description: string
	difficulty: "beginner" | "intermediate" | "advanced"
	estimatedHours: number
	lrnReward: number
	lessonCount: number
	coverImage?: string
	isEnrolled?: boolean
	isChecking?: boolean
	isEnrolling?: boolean
	needsPersistence?: boolean
	enrollError?: string | null
	continueHref?: string | null
	onEnroll?: () => void
	onRetryPersistence?: () => void
}

const CourseCard: React.FC<CourseCardProps> = ({
	id,
	title,
	description,
	difficulty,
	estimatedHours,
	lrnReward,
	lessonCount,
	coverImage,
	isEnrolled = false,
	isChecking = false,
	isEnrolling = false,
	needsPersistence = false,
	enrollError = null,
	continueHref = null,
	onEnroll,
	onRetryPersistence,
}) => {
	const isPending = isChecking || isEnrolling
	const continuePath = continueHref ?? `/courses/${id}/lessons/1`
	const actionLabel = needsPersistence
		? "Retry sync"
		: isChecking
			? "Checking..."
			: isEnrolling
				? "Enrolling..."
				: "Enroll Now"

	return (
		<div className="glass-card flex flex-col h-full rounded-[2.5rem] border border-white/5 overflow-hidden hover:border-brand-cyan/40 hover:shadow-[0_0_40px_rgba(0,212,255,0.1)] transition-all duration-500 group relative">
			{isEnrolled ? (
				<div className="absolute left-5 top-5 z-20 rounded-full border border-brand-cyan/40 bg-brand-cyan/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand-cyan">
					Enrolled
				</div>
			) : null}
			<div className="absolute top-0 right-0 w-32 h-32 bg-brand-cyan/10 blur-[50px] mix-blend-screen pointer-events-none group-hover:bg-brand-cyan/20 transition-colors" />

			<div className="relative h-48 w-full overflow-hidden bg-linear-to-br from-[#12101e] to-[#1e1840] border-b border-white/5">
				{coverImage ? (
					<img
						src={coverImage}
						alt={title}
						className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
					/>
				) : (
					<div className="w-full h-full flex items-center justify-center font-black text-6xl text-white/5 group-hover:scale-110 transition-transform duration-700">
						{title.charAt(0).toUpperCase()}
					</div>
				)}
				<div className="absolute top-5 left-5">
					<CourseCategoryBadge
						category={difficulty}
						className="text-[10px] font-black uppercase tracking-widest backdrop-blur-md"
					/>
				</div>
				<div className="absolute top-5 right-5">
					<BookmarkButton courseId={id} />
				</div>
			</div>

			<div className="p-8 flex flex-col flex-1 relative z-10">
				<h3 className="text-2xl font-black mb-3 text-white leading-tight tracking-tight">
					{title}
				</h3>
				<p className="text-white/40 text-sm leading-relaxed mb-6 flex-1 line-clamp-3">
					{description}
				</p>

				<div className="flex flex-wrap items-center justify-between py-4 border-t border-white/5 gap-4">
					<div className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
						<span className="text-lg opacity-80 leading-none">📖</span>{" "}
						{lessonCount} Lessons
					</div>
					<div className="text-xs font-bold text-brand-cyan uppercase tracking-widest bg-brand-cyan/10 px-3 py-1.5 rounded-xl border border-brand-cyan/20 flex items-center gap-1.5 shadow-inner shadow-brand-cyan/10">
						<span className="text-[14px] leading-none">🏆</span> +{lrnReward}{" "}
						LRN
					</div>
				</div>

				<div className="mt-6">
					{isEnrolled ? (
						<Link
							to={continuePath}
							className="block w-full text-center py-4 glass rounded-2xl border border-white/10 text-white font-black hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all text-xs uppercase tracking-[3px]"
						>
							Continue Track
						</Link>
					) : (
						<button
							type="button"
							onClick={needsPersistence ? onRetryPersistence : onEnroll}
							disabled={isPending}
							aria-busy={isPending}
							aria-disabled={isPending}
							className="w-full text-center py-4 bg-white text-black rounded-2xl border border-transparent hover:bg-brand-cyan hover:shadow-[0_0_20px_rgba(0,212,255,0.4)] hover:text-black active:scale-95 transition-all font-black text-xs uppercase tracking-[3px] disabled:cursor-not-allowed disabled:opacity-60"
						>
							{actionLabel}
						</button>
					)}
				</div>
				{enrollError ? (
					<p className="mt-3 text-xs text-red-300" role="alert">
						{enrollError}
					</p>
				) : null}
			</div>
		</div>
	)
}

export default CourseCard
