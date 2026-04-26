type LessonTimeEntry = {
	courseId: string
	lessonId: number
	secondsSpent: number
	estimatedMinutes?: number
	completedAt?: string
}

type ActiveSession = {
	courseId: string
	lessonId: number
	startedAt: string
}

type LearningTimeState = {
	totalSeconds: number
	lessons: Record<string, LessonTimeEntry>
	activeSession: ActiveSession | null
}

type StopSessionResult = {
	addedSeconds: number
	lesson: LessonTimeEntry
	totalSeconds: number
}

const STORAGE_KEY = "learnvault:learning-time:v1"

function defaultState(): LearningTimeState {
	return {
		totalSeconds: 0,
		lessons: {},
		activeSession: null,
	}
}

function safeNowIso(): string {
	return new Date().toISOString()
}

function toLessonKey(courseId: string, lessonId: number): string {
	return `${courseId}:${lessonId}`
}

function parseState(raw: string | null): LearningTimeState {
	if (!raw) return defaultState()

	try {
		const parsed = JSON.parse(raw) as Partial<LearningTimeState>
		return {
			totalSeconds:
				typeof parsed.totalSeconds === "number" && parsed.totalSeconds > 0
					? parsed.totalSeconds
					: 0,
			lessons:
				parsed.lessons && typeof parsed.lessons === "object"
					? parsed.lessons
					: {},
			activeSession:
				parsed.activeSession && typeof parsed.activeSession === "object"
					? parsed.activeSession
					: null,
		}
	} catch {
		return defaultState()
	}
}

function readState(): LearningTimeState {
	if (typeof window === "undefined" || !window.localStorage) {
		return defaultState()
	}

	return parseState(window.localStorage.getItem(STORAGE_KEY))
}

function writeState(state: LearningTimeState): void {
	if (typeof window === "undefined" || !window.localStorage) return
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function stopActiveSessionIfAny(
	state: LearningTimeState,
): StopSessionResult | null {
	const active = state.activeSession
	if (!active) return null

	const started = new Date(active.startedAt).getTime()
	const now = Date.now()
	const elapsedSeconds = Math.max(0, Math.floor((now - started) / 1000))
	const key = toLessonKey(active.courseId, active.lessonId)
	const existing = state.lessons[key] ?? {
		courseId: active.courseId,
		lessonId: active.lessonId,
		secondsSpent: 0,
	}

	const updatedLesson: LessonTimeEntry = {
		...existing,
		secondsSpent: existing.secondsSpent + elapsedSeconds,
	}

	state.lessons[key] = updatedLesson
	state.totalSeconds += elapsedSeconds
	state.activeSession = null

	return {
		addedSeconds: elapsedSeconds,
		lesson: updatedLesson,
		totalSeconds: state.totalSeconds,
	}
}

export function startLessonSession(
	courseId: string,
	lessonId: number,
	estimatedMinutes?: number,
): void {
	if (!courseId || !Number.isInteger(lessonId) || lessonId < 1) return

	const state = readState()
	stopActiveSessionIfAny(state)

	const key = toLessonKey(courseId, lessonId)
	const existing = state.lessons[key]
	if (
		existing &&
		typeof estimatedMinutes === "number" &&
		estimatedMinutes > 0
	) {
		state.lessons[key] = { ...existing, estimatedMinutes }
	}

	state.activeSession = {
		courseId,
		lessonId,
		startedAt: safeNowIso(),
	}

	writeState(state)
}

export function stopLessonSession(
	courseId: string,
	lessonId: number,
): StopSessionResult | null {
	const state = readState()
	const active = state.activeSession
	if (!active) return null
	if (active.courseId !== courseId || active.lessonId !== lessonId) return null

	const result = stopActiveSessionIfAny(state)
	writeState(state)
	return result
}

export function completeLessonSession(
	courseId: string,
	lessonId: number,
	estimatedMinutes?: number,
): LessonTimeEntry {
	const state = readState()
	const key = toLessonKey(courseId, lessonId)

	if (
		state.activeSession &&
		state.activeSession.courseId === courseId &&
		state.activeSession.lessonId === lessonId
	) {
		stopActiveSessionIfAny(state)
	}

	const existing = state.lessons[key] ?? {
		courseId,
		lessonId,
		secondsSpent: 0,
	}
	const updated: LessonTimeEntry = {
		...existing,
		estimatedMinutes:
			typeof estimatedMinutes === "number" && estimatedMinutes > 0
				? estimatedMinutes
				: existing.estimatedMinutes,
		completedAt: safeNowIso(),
	}

	state.lessons[key] = updated
	writeState(state)
	return updated
}

export function getLessonTime(
	courseId: string,
	lessonId: number,
): LessonTimeEntry | null {
	const state = readState()
	return state.lessons[toLessonKey(courseId, lessonId)] ?? null
}

export function getLearningTimeSummary(): {
	totalSeconds: number
	totalLessonsTracked: number
	totalLessonsCompleted: number
} {
	const state = readState()
	const lessons = Object.values(state.lessons)
	const totalLessonsCompleted = lessons.filter(
		(lesson) => lesson.completedAt,
	).length

	return {
		totalSeconds: state.totalSeconds,
		totalLessonsTracked: lessons.length,
		totalLessonsCompleted,
	}
}

export function formatDuration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds <= 0) return "0m"

	const totalMinutes = Math.floor(seconds / 60)
	const hours = Math.floor(totalMinutes / 60)
	const minutes = totalMinutes % 60

	if (hours <= 0) return `${minutes}m`
	if (minutes === 0) return `${hours}h`
	return `${hours}h ${minutes}m`
}
