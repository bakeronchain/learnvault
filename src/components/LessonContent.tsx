import { Button } from "@stellar/design-system"
import React from "react"
import ReactMarkdown from "react-markdown"
import { Link } from "react-router-dom"
import { type Lesson } from "../data/lessons"

// A simple mock skeleton to match what's needed for content loading state
export const LessonContentSkeleton = () => (
	<div className="animate-pulse space-y-6">
		<div className="h-10 bg-white/10 rounded-xl w-3/4 mb-10" />
		<div className="space-y-4">
			<div className="h-4 bg-white/10 rounded w-full" />
			<div className="h-4 bg-white/10 rounded w-5/6" />
			<div className="h-4 bg-white/10 rounded w-4/6" />
			<div className="h-4 bg-white/10 rounded w-full" />
		</div>
		<div className="pt-10 space-y-4">
			<div className="h-6 bg-white/10 rounded-lg w-1/4 mb-4" />
			<div className="h-4 bg-white/10 rounded w-full" />
			<div className="h-4 bg-white/10 rounded w-5/6" />
		</div>
	</div>
)

interface LessonContentProps {
	lesson: Lesson
	isLoading: boolean
	isCompleted: boolean
	isCompleting: boolean
	onMarkComplete: () => void
	prevLessonId: number | null
	nextLessonId: number | null
	isNextLocked: boolean
}

const LessonContent: React.FC<LessonContentProps> = ({
	lesson,
	isLoading,
	isCompleted,
	isCompleting,
	onMarkComplete,
	prevLessonId,
	nextLessonId,
	isNextLocked,
}) => {
	if (isLoading) {
		return (
			<section className="glass-card p-8 md:p-12 rounded-[2.5rem] border border-white/10">
				<LessonContentSkeleton />
			</section>
		)
	}

	return (
		<section className="glass-card p-8 md:p-12 rounded-[2.5rem] border border-white/10 flex flex-col h-full">
			<div className="flex-1 prose prose-invert prose-brand max-w-none">
				<ReactMarkdown>{lesson.content}</ReactMarkdown>
			</div>

			<div className="mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6">
				<div className="flex gap-4">
					{prevLessonId ? (
						<Link
							to={`../${prevLessonId}`}
							className="px-5 py-2.5 rounded-xl font-semibold border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08] transition-colors"
						>
							Previous
						</Link>
					) : (
						<div className="px-5 py-2.5 rounded-xl font-semibold opacity-30 cursor-not-allowed">
							Previous
						</div>
					)}
					{nextLessonId ? (
						<Link
							to={isNextLocked ? "#" : `../${nextLessonId}`}
							className={`px-5 py-2.5 rounded-xl font-semibold transition-colors ${
								isNextLocked
									? "opacity-30 cursor-not-allowed border border-white/10 bg-white/[0.03]"
									: "border border-brand-cyan/30 text-brand-cyan bg-brand-blue/10 hover:bg-brand-blue/20"
							}`}
							onClick={(e) => {
								if (isNextLocked) e.preventDefault()
							}}
						>
							Next Lesson {isNextLocked && "🔒"}
						</Link>
					) : (
						<div className="px-5 py-2.5 rounded-xl font-semibold opacity-30 cursor-not-allowed">
							Next Lesson
						</div>
					)}
				</div>

				<Button
					onClick={onMarkComplete}
					disabled={isCompleted || isCompleting}
					isLoading={isCompleting}
					variant={isCompleted ? "secondary" : "primary"}
					size="md"
					className={
						isCompleted
							? "opacity-100 bg-brand-emerald/20 text-brand-emerald border-brand-emerald"
							: "shadow-lg"
					}
				>
					{isCompleted
						? "Lesson Completed ✓"
						: isCompleting
							? "Confirming..."
							: "Mark as Complete"}
				</Button>
			</div>
		</section>
	)
}

export default LessonContent
