import { Button } from "@stellar/design-system"
import React, { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import LessonContent from "../components/LessonContent"
import LessonSidebar from "../components/LessonSidebar"
import MilestoneSubmitPanel from "../components/MilestoneSubmitPanel"
import { LessonListSkeleton } from "../components/skeletons/LessonListSkeleton"
import { useCourse } from "../hooks/useCourse"
import { useCourseDetail } from "../hooks/useCourses"
import { useWallet } from "../hooks/useWallet"
import { connectWallet } from "../util/wallet"
import {
	completeLessonSession,
	formatDuration,
	getLessonTime,
	startLessonSession,
	stopLessonSession,
} from "../util/learningTime"
import NotFound from "./NotFound"

const loadingLesson = {
	id: 0,
	courseId: "",
	title: "Loading lesson...",
	content: "",
	order: 0,
	isMilestone: false,
}

const LessonView: React.FC = () => {
	const { courseId, lessonId: lessonIdParam } = useParams<{
		courseId: string
		lessonId: string
	}>()
	const lessonId = parseInt(lessonIdParam || "0", 10)

	const { address } = useWallet()
	const { getCourseProgress, completeMilestone, isCompletingMilestone } =
		useCourse()
	const {
		course,
		isLoading: isLoadingCourse,
		error: courseError,
	} = useCourseDetail(courseId)

	const [isLoadingContent, setIsLoadingContent] = useState(true)
	const [isSidebarOpen, setIsSidebarOpen] = useState(false)
	const [timeSpentLabel, setTimeSpentLabel] = useState<string | null>(null)

	useEffect(() => {
		// Simulate a short content load delay
		setIsLoadingContent(true)
		const timer = setTimeout(() => setIsLoadingContent(false), 500)
		return () => clearTimeout(timer)
	}, [lessonId])

	useEffect(() => {
		setIsSidebarOpen(false)
	}, [lessonId])

	const lesson = useMemo(
		() => course?.lessons.find((candidate) => candidate.id === lessonId),
		[course, lessonId],
	)
	const allLessons = useMemo(() => course?.lessons ?? [], [course])

	if (!isLoadingCourse && (courseError || !course || !lesson)) {
		return <NotFound />
	}

	if (!address) {
		return (
			<div className="container mx-auto px-4 py-24 flex items-center justify-center">
				<div className="glass-card max-w-lg w-full p-10 rounded-[2.5rem] border border-white/10 text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
					<div className="w-16 h-16 mx-auto bg-brand-cyan/20 rounded-full flex items-center justify-center mb-6">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							strokeWidth={1.5}
							stroke="currentColor"
							className="w-8 h-8 text-brand-cyan"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
							/>
						</svg>
					</div>
					<h2 className="text-3xl font-bold mb-4 text-white">
						Wallet Required
					</h2>
					<p className="text-white/60 mb-8 text-lg">
						Please connect your wallet to access track content and track your
						learning milestones on-chain.
					</p>
					<Button
						variant="primary"
						size="md"
						onClick={() => void connectWallet()}
					>
						Connect Wallet
					</Button>
				</div>
			</div>
		)
	}

	if (!course || !lesson) {
		return (
			<div className="container mx-auto px-4 py-8 lg:py-12 max-w-7xl">
				<div className="grid grid-cols-1 lg:grid-cols-[1fr_2.5fr] gap-8">
					<LessonListSkeleton />
					<LessonContent
						lesson={loadingLesson}
						isLoading={true}
						isCompleted={false}
						isCompleting={false}
						onMarkComplete={() => {}}
						prevLessonId={null}
						nextLessonId={null}
						isNextLocked={true}
					/>
				</div>
			</div>
		)
	}

	const progress = getCourseProgress(courseId || "")
	const completedMilestones = progress.completedMilestoneIds

	const lessonIndex = allLessons.findIndex((l) => l.id === lessonId)
	const isCompleted = completedMilestones.includes(lessonId)

	// Check if the current lesson is locked
	const previousCompleted =
		lessonIndex === 0 ||
		completedMilestones.includes(allLessons[lessonIndex - 1]?.id ?? -1)

	if (!isCompleted && !previousCompleted && lessonIndex > 0) {
		return (
			<div className="container mx-auto px-4 py-24 flex items-center justify-center">
				<div className="glass-card max-w-lg w-full p-10 rounded-[2.5rem] border border-white/10 text-center animate-in zoom-in-95 duration-500">
					<div className="text-5xl mb-6">🔒</div>
					<h2 className="text-2xl font-bold mb-4 text-white">Lesson Locked</h2>
					<p className="text-white/60 mb-8">
						You must complete the previous lesson before starting this one.
					</p>
					<button
						onClick={() => window.history.back()}
						className="px-6 py-2 border border-white/10 bg-white/[0.03] text-white rounded-xl hover:bg-white/[0.08]"
					>
						Go Back
					</button>
				</div>
			</div>
		)
	}

	const prevLessonId =
		lessonIndex > 0 ? (allLessons[lessonIndex - 1]?.id ?? null) : null
	const nextLessonId =
		lessonIndex < allLessons.length - 1
			? (allLessons[lessonIndex + 1]?.id ?? null)
			: null

	const isNextLocked = !isCompleted

	useEffect(() => {
		if (!course || !lesson) return

		startLessonSession(course.slug, lesson.id, lesson.estimatedMinutes)
		const existing = getLessonTime(course.slug, lesson.id)
		setTimeSpentLabel(
			existing ? formatDuration(existing.secondsSpent) : formatDuration(0),
		)

		return () => {
			const stopped = stopLessonSession(course.slug, lesson.id)
			if (stopped) {
				setTimeSpentLabel(formatDuration(stopped.lesson.secondsSpent))
			}
		}
	}, [course, lesson])

	const handleMarkComplete = async () => {
		if (!courseId || !course || !lesson) return

		const completedOnChain = await completeMilestone(courseId, lessonId)
		if (completedOnChain) {
			const completed = completeLessonSession(
				course.slug,
				lesson.id,
				lesson.estimatedMinutes,
			)
			setTimeSpentLabel(formatDuration(completed.secondsSpent))
		}
	}

	return (
		<div className="container mx-auto px-4 py-8 lg:py-12 max-w-7xl animate-in fade-in slide-in-from-bottom-8 duration-700">
			<header className="mb-8 md:mb-12">
				<div className="flex items-center gap-3 mb-4">
					<span className="px-3 py-1 rounded-full text-xs font-semibold bg-brand-blue/20 text-brand-cyan border border-brand-cyan/20">
						{course.track}
					</span>
					<span className="text-white/40 text-sm">{course.title}</span>
				</div>
				<h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
					{lesson.title}
				</h1>
			</header>

			<div className="lg:hidden mb-6">
				<button
					type="button"
					onClick={() => setIsSidebarOpen(true)}
					className="w-full px-4 py-3 rounded-2xl border border-white/10 glass text-sm font-black uppercase tracking-widest text-white/70 hover:text-white hover:border-white/20 transition-colors"
				>
					Open Track Outline
				</button>
			</div>

			<div
				className={`lg:hidden ${isSidebarOpen ? "pointer-events-auto" : "pointer-events-none"}`}
			>
				<button
					type="button"
					aria-label="Close lesson sidebar backdrop"
					onClick={() => setIsSidebarOpen(false)}
					className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
						isSidebarOpen ? "opacity-100" : "opacity-0"
					}`}
				/>
				<aside
					className={`fixed left-0 top-0 z-50 h-full w-[min(22rem,90vw)] border-r border-white/10 bg-[#070910] p-4 transition-transform duration-300 ${
						isSidebarOpen ? "translate-x-0" : "-translate-x-full"
					}`}
				>
					<div className="mb-4 flex items-center justify-between">
						<span className="text-xs font-black uppercase tracking-[0.25em] text-white/40">
							Lessons
						</span>
						<button
							type="button"
							onClick={() => setIsSidebarOpen(false)}
							className="w-9 h-9 rounded-xl border border-white/10 text-white/70 hover:text-white hover:border-white/20"
							aria-label="Close lesson sidebar"
						>
							×
						</button>
					</div>
					{isLoadingCourse || isLoadingContent ? (
						<LessonListSkeleton />
					) : (
						<LessonSidebar
							courseId={course.slug}
							lessons={allLessons}
							completedMilestones={completedMilestones}
							currentLessonId={lessonId}
						/>
					)}
				</aside>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-[1fr_2.5fr] gap-8">
				<div className="hidden lg:block lg:sticky lg:top-28 h-fit">
					{isLoadingCourse || isLoadingContent ? (
						<LessonListSkeleton />
					) : (
						<LessonSidebar
							courseId={course.slug}
							lessons={allLessons}
							completedMilestones={completedMilestones}
							currentLessonId={lessonId}
						/>
					)}
				</div>

				<div>
					<LessonContent
						lesson={lesson ?? loadingLesson}
						isLoading={isLoadingCourse || isLoadingContent}
						isCompleted={isCompleted}
						isCompleting={isCompletingMilestone}
						timeSpentLabel={timeSpentLabel}
						onMarkComplete={handleMarkComplete}
						prevLessonId={prevLessonId}
						nextLessonId={nextLessonId}
						isNextLocked={isNextLocked}
					/>

					{lesson?.isMilestone && !isLoadingCourse && !isLoadingContent && (
						<div className="mt-12 animate-in fade-in slide-in-from-top-4 duration-1000">
							<MilestoneSubmitPanel
								courseId={course.slug}
								milestoneId={lesson.id}
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export default LessonView
