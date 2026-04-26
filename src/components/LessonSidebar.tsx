import React from "react"
import { Link } from "react-router-dom"
import { type CourseLesson as Lesson } from "../types/courses"

interface LessonSidebarProps {
	courseId: string
	lessons: Lesson[]
	completedMilestones: number[]
	readLessonIds?: number[]
	currentLessonId: number
}

const LessonSidebar: React.FC<LessonSidebarProps> = ({
	courseId,
	lessons,
	completedMilestones,
	readLessonIds = [],
	currentLessonId,
}) => {
	const totalLessons = lessons.length
	const completedCount = completedMilestones.length
	const progressPercent =
		totalLessons > 0 ? (completedCount / totalLessons) * 100 : 0

	// Locally read but not yet server-confirmed
	const localReadOnly = readLessonIds.filter(
		(id) => !completedMilestones.includes(id),
	)
	const readPercent =
		totalLessons > 0
			? ((completedCount + localReadOnly.length) / totalLessons) * 100
			: 0

	return (
		<aside className="glass-card flex flex-col h-full rounded-[2.5rem] border border-white/10 p-6">
			<h3 className="text-xl font-bold mb-6 text-white tracking-tight">
				Track Outline
			</h3>

			<div className="mb-8">
				<div className="flex justify-between text-sm text-white/60 mb-2 font-medium">
					<span>Progress</span>
					<span>
						{completedCount} of {totalLessons}
					</span>
				</div>
				{/* Two-layer bar: local-read (soft cyan) behind server-complete (solid cyan) */}
				<div
					className="relative h-2 w-full bg-white/10 rounded-full overflow-hidden"
					role="progressbar"
					aria-valuenow={Math.round(progressPercent)}
					aria-valuemin={0}
					aria-valuemax={100}
				>
					<div
						className="absolute inset-y-0 left-0 bg-brand-cyan/30 rounded-full transition-all duration-500 ease-out"
						style={{ width: `${readPercent}%` }}
					/>
					<div
						className="absolute inset-y-0 left-0 bg-brand-cyan rounded-full transition-all duration-500 ease-out"
						style={{ width: `${progressPercent}%` }}
					/>
				</div>
			</div>

			<ul className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
				{lessons.map((l, index) => {
					const isCompleted = completedMilestones.includes(l.id)
					const isLocalRead = !isCompleted && readLessonIds.includes(l.id)
					const isCurrent = l.id === currentLessonId
					const previousCompleted =
						index === 0 ||
						completedMilestones.includes(lessons[index - 1]?.id ?? -1)
					const isLocked = !isCompleted && !previousCompleted && !isCurrent

					return (
						<li key={l.id}>
							{isLocked ? (
								<div className="flex items-start gap-3 p-3 rounded-2xl border border-transparent opacity-50 cursor-not-allowed">
									<div className="mt-1 w-6 h-6 flex shrink-0 items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/40">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											strokeWidth={2}
											stroke="currentColor"
											className="w-3 h-3"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
											/>
										</svg>
									</div>
									<span className="text-sm font-medium text-white/50 pt-1">
										{l.title}
									</span>
								</div>
							) : (
								<Link
									to={`/courses/${courseId}/lessons/${l.id}`}
									className={`flex items-start gap-3 p-3 rounded-2xl border transition-colors ${
										isCurrent
											? "bg-brand-blue/20 border-brand-cyan/30 text-white"
											: "bg-white/[0.02] border-white/5 hover:bg-white/[0.06] text-white/80"
									}`}
								>
									<div
										className={`mt-1 w-6 h-6 flex shrink-0 items-center justify-center rounded-full border ${
											isCompleted
												? "bg-brand-emerald/20 border-brand-emerald text-brand-emerald"
												: isLocalRead
													? "bg-brand-cyan/10 border-brand-cyan/40 text-brand-cyan/60"
													: isCurrent
														? "border-brand-cyan text-brand-cyan"
														: "border-white/20 text-white/40"
										}`}
										title={
											isLocalRead
												? "Lesson read (not yet completed on-chain)"
												: undefined
										}
									>
										{isCompleted ? (
											// Hard checkmark — server-confirmed completion
											<svg
												xmlns="http://www.w3.org/2000/svg"
												viewBox="0 0 20 20"
												fill="currentColor"
												className="w-4 h-4"
											>
												<path
													fillRule="evenodd"
													d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
													clipRule="evenodd"
												/>
											</svg>
										) : isLocalRead ? (
											// Soft checkmark — locally read but not on-chain yet
											<svg
												xmlns="http://www.w3.org/2000/svg"
												viewBox="0 0 20 20"
												fill="none"
												stroke="currentColor"
												strokeWidth={2}
												className="w-3.5 h-3.5"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													d="M16.704 4.153l-8 10.5-4.5-4.5"
												/>
											</svg>
										) : (
											<span className="text-[10px] font-bold">{index + 1}</span>
										)}
									</div>
									<div className="flex min-w-0 flex-1 items-center justify-between gap-3">
										<span className="text-sm font-medium pt-1 leading-snug">
											{l.title}
										</span>
										<span className="shrink-0 rounded-full border border-brand-cyan/20 bg-brand-cyan/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-cyan">
											~{Math.max(1, l.estimatedMinutes)}m
										</span>
									</div>
								</Link>
							)}
						</li>
					)
				})}
			</ul>
		</aside>
	)
}

export default LessonSidebar
