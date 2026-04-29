import React from "react"
import { Link } from "react-router-dom"

import BookmarkButton from "./BookmarkButton"

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
	onEnroll?: () => void
}

const difficultyConfig: Record<
	CourseCardProps["difficulty"],
	{ label: string; className: string }
> = {
	beginner: {
		label: "Beginner",
		className: "bg-brand-emerald/10 text-brand-emerald border-brand-emerald/20",
	},
	intermediate: {
		label: "Intermediate",
		className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
	},
	advanced: {
		label: "Advanced",
		className: "bg-red-500/10 text-red-500 border-red-500/20",
	},
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
	onEnroll,
}) => {
	const difficultyData = difficultyConfig[difficulty]

	return (
		<div className="glass-card flex flex-col h-full rounded-[2.5rem] border border-white/5 overflow-hidden hover:border-brand-cyan/40 hover:shadow-[0_0_40px_rgba(0,212,255,0.1)] transition-all duration-500 group relative">
			{/* Decorative background glow */}
			<div className="absolute top-0 right-0 w-32 h-32 bg-brand-cyan/10 blur-[50px] mix-blend-screen pointer-events-none group-hover:bg-brand-cyan/20 transition-colors" />

			{/* Cover Image Placeholder */}
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
				{/* Difficulty Badge overlaying image */}
				<div className="absolute top-5 left-5">
					<span
						className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border backdrop-blur-md ${difficultyData.className}`}
					>
						{difficultyData.label}
					</span>
				</div>
				{/* Bookmark toggle (hidden when wallet not connected) */}
				<div className="absolute top-5 right-5">
					<BookmarkButton courseId={id} />
				</div>
			</div>

			{/* Card Content */}
			<div className="p-8 flex flex-col flex-1 relative z-10">
				<h3 className="text-2xl font-black mb-3 text-white leading-tight tracking-tight">
					{title}
				</h3>
				<p className="text-white/40 text-sm leading-relaxed mb-6 flex-1 line-clamp-3">
					{description}
				</p>

				{/* Metrics Row */}
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

				{/* Button */}
				<div className="mt-6">
					{isEnrolled ? (
						<Link
							to={`/courses/${id}/lessons/1`}
							className="block w-full text-center py-4 glass rounded-2xl border border-white/10 text-white font-black hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all text-xs uppercase tracking-[3px]"
						>
							Continue Track
						</Link>
					) : (
						<button
							onClick={onEnroll}
							className="w-full text-center py-4 bg-white text-black rounded-2xl border border-transparent hover:bg-brand-cyan hover:shadow-[0_0_20px_rgba(0,212,255,0.4)] hover:text-black active:scale-95 transition-all font-black text-xs uppercase tracking-[3px]"
						>
							Enroll Now
						</button>
					)}
				</div>
			</div>
		</div>
	)
}

export default CourseCard
