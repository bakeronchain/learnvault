import { useQuery } from "@tanstack/react-query"
import {
	type CoursePrerequisite,
	type CourseDetail,
	type CourseDifficulty,
	type CourseLesson,
	type CourseLevel,
	type CourseRatingSummary,
	type CourseSummary,
} from "../types/courses"

type CourseListResponse = {
	data?: ApiCourse[]
}

type ApiCourse = {
	id: number | string
	slug?: string
	title?: string
	description?: string
	coverImage?: string | null
	cover_image_url?: string | null
	track?: string
	difficulty?: string
	published?: boolean
	createdAt?: string
	created_at?: string
	updatedAt?: string
	updated_at?: string
	prerequisites?: Array<{
		id?: number | string
		slug?: string
		title?: string
		course_id?: number | string
		course_slug?: string
		course_title?: string
	}>
	prerequisite_courses?: Array<{
		id?: number | string
		slug?: string
		title?: string
		course_id?: number | string
		course_slug?: string
		course_title?: string
	}>
	rating_summary?: { average?: number; count?: number } | null
	review_summary?: { average?: number; count?: number } | null
	review_count?: number
	average_rating?: number
}

type ApiLesson = {
	id: number | string
	courseId?: number | string
	course_id?: number | string
	title?: string
	content?: string
	content_markdown?: string
	order?: number
	order_index?: number
	estimatedMinutes?: number
	estimated_minutes?: number
	isMilestone?: boolean
	is_milestone?: boolean
	version?: number
	isLatest?: boolean
	is_latest?: boolean
	changeSummary?: string | null
	change_summary?: string | null
}

const defaultAccentClassName =
	"from-brand-cyan/20 via-brand-blue/15 to-transparent"

const accentClassByTrack: Record<string, string> = {
	defi: "from-emerald-400/25 via-teal-400/15 to-transparent",
	smartcontracts: "from-fuchsia-400/25 via-violet-400/15 to-transparent",
	stellar: "from-brand-cyan/25 via-brand-blue/20 to-transparent",
	web3: "from-sky-400/25 via-cyan-400/15 to-transparent",
}

const normalizeTrackKey = (value: string | undefined): string =>
	(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")

const formatTrackLabel = (track: string | undefined): string => {
	const key = normalizeTrackKey(track)
	if (key === "web3") return "Web3"
	if (key === "defi") return "DeFi"
	if (key === "smartcontracts") return "Smart Contracts"
	if (key === "stellar") return "Stellar"

	if (!track) return "General"

	return track
		.split(/[\s_-]+/)
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ")
}

const formatLevel = (difficulty: CourseDifficulty): CourseLevel => {
	if (difficulty === "intermediate") return "Intermediate"
	if (difficulty === "advanced") return "Advanced"
	return "Beginner"
}

const normalizeDifficulty = (
	difficulty: string | undefined,
): CourseDifficulty => {
	if (difficulty === "intermediate" || difficulty === "advanced") {
		return difficulty
	}

	return "beginner"
}

const normalizeCourse = (course: ApiCourse): CourseSummary => {
	const difficulty = normalizeDifficulty(course.difficulty)
	const trackLabel = formatTrackLabel(course.track)
	const trackKey = normalizeTrackKey(course.track)

	const rawSummary = course.rating_summary ?? course.review_summary
	const summaryFromObject: CourseRatingSummary | null =
		rawSummary &&
		Number.isFinite(Number(rawSummary.average)) &&
		Number.isFinite(Number(rawSummary.count))
			? {
					average: Number(rawSummary.average),
					count: Number(rawSummary.count),
				}
			: null
	const summaryFromFlat =
		Number.isFinite(Number(course.average_rating)) &&
		Number.isFinite(Number(course.review_count))
			? {
					average: Number(course.average_rating),
					count: Number(course.review_count),
				}
			: null

	return {
		id: course.slug || String(course.id),
		slug: course.slug || String(course.id),
		title: course.title || "Untitled Course",
		description: course.description || "Course description coming soon.",
		coverImage: course.coverImage ?? course.cover_image_url ?? null,
		track: trackLabel,
		trackKey,
		difficulty,
		level: formatLevel(difficulty),
		published: Boolean(course.published),
		createdAt: course.createdAt ?? course.created_at ?? "",
		updatedAt: course.updatedAt ?? course.updated_at ?? "",
		accentClassName: accentClassByTrack[trackKey] ?? defaultAccentClassName,
		ratingSummary: summaryFromObject ?? summaryFromFlat,
	}
}

const normalizeLesson = (
	lesson: ApiLesson,
	courseSlug: string,
): CourseLesson => ({
	id: Number(lesson.id),
	courseId: courseSlug,
	title: lesson.title || "Untitled Lesson",
	content: lesson.content ?? lesson.content_markdown ?? "",
	order:
		typeof lesson.order === "number"
			? lesson.order
			: Number(lesson.order_index ?? 0),
	estimatedMinutes:
		typeof lesson.estimatedMinutes === "number"
			? lesson.estimatedMinutes
			: Number(lesson.estimated_minutes ?? 10),
	isMilestone: Boolean(lesson.isMilestone ?? lesson.is_milestone),
	version:
		typeof lesson.version === "number"
			? lesson.version
			: Number.parseInt(String(lesson.version ?? "1"), 10),
	isLatest: Boolean(lesson.isLatest ?? lesson.is_latest ?? true),
	changeSummary: lesson.changeSummary ?? lesson.change_summary ?? null,
})

async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url, {
		headers: {
			"Content-Type": "application/json",
		},
	})

	if (!response.ok) {
		// Avoid trying to parse HTML error pages (dev server 404s etc.) as JSON
		const contentType = response.headers.get("content-type") ?? ""
		if (contentType.includes("application/json")) {
			const error = await response.json().catch(() => ({}))
			throw new Error(
				(error as { error?: string }).error || `Request failed for ${url}`,
			)
		}
		throw new Error(`Request failed for ${url} (${response.status})`)
	}

	return response.json() as Promise<T>
}

export async function fetchCourses(): Promise<CourseSummary[]> {
	const response = await fetchJson<CourseListResponse | ApiCourse[]>(
		"/api/courses",
	)
	const courses = Array.isArray(response) ? response : (response.data ?? [])
	return courses.map(normalizeCourse)
}

export function useCourses() {
	const query = useQuery({
		queryKey: ["courses"],
		queryFn: fetchCourses,
		staleTime: 60 * 1000,
	})

	return {
		courses: query.data ?? [],
		isLoading: query.isLoading,
		error: query.error instanceof Error ? query.error.message : null,
		refetch: query.refetch,
	}
}

type EnrolledApiCourse = {
	id: number | string
	slug?: string
	title?: string
	completedMilestones?: number
	completed_milestones?: number
	totalMilestones?: number
	total_milestones?: number
	milestones?: Array<{
		id: number
		label?: string
		title?: string
		lrnReward?: number
		lrn_reward?: number
	}>
}

export type EnrolledCourse = {
	courseId: string
	title: string
	completedCount: number
	totalCount: number
	progressPercent: number
	milestones: Array<{ id: number; label: string; lrnReward: number }>
}

const normalizeEnrolledCourse = (c: EnrolledApiCourse): EnrolledCourse => {
	const courseId = c.slug ?? String(c.id)
	const completedCount = c.completedMilestones ?? c.completed_milestones ?? 0
	const totalCount = c.totalMilestones ?? c.total_milestones ?? 0
	const progressPercent =
		totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
	const milestones = (c.milestones ?? []).map((m) => ({
		id: m.id,
		label: m.label ?? m.title ?? `Milestone ${m.id}`,
		lrnReward: m.lrnReward ?? m.lrn_reward ?? 0,
	}))
	return {
		courseId,
		title: c.title ?? "Untitled Course",
		completedCount,
		totalCount,
		progressPercent,
		milestones,
	}
}

export function useEnrolledCourses() {
	const query = useQuery({
		queryKey: ["courses", "enrolled"],
		queryFn: async (): Promise<EnrolledCourse[]> => {
			const response = await fetchJson<EnrolledApiCourse[]>(
				"/api/courses/enrolled",
			)
			return (Array.isArray(response) ? response : []).map(
				normalizeEnrolledCourse,
			)
		},
		staleTime: 60 * 1000,
	})

	return {
		enrolledCourses: query.data ?? [],
		isLoading: query.isLoading,
		error: query.error instanceof Error ? query.error.message : null,
		refetch: query.refetch,
	}
}

export function useCourseDetail(
	idOrSlug: string | undefined,
	learnerAddress?: string,
) {
	const query = useQuery({
		queryKey: ["course", idOrSlug, learnerAddress],
		queryFn: async (): Promise<CourseDetail> => {
			const params = new URLSearchParams()
			if (learnerAddress) params.set("learner_address", learnerAddress)
			const url = `/api/courses/${idOrSlug}${params.toString() ? `?${params.toString()}` : ""}`
			const response = await fetchJson<
				ApiCourse & {
					lessons?: ApiLesson[]
					enrollmentContentVersion?: number | null
					enrollment_content_version?: number | null
					latestContentVersion?: number
					latest_content_version?: number
					hasUpdatedContent?: boolean
					has_updated_content?: boolean
				}
			>(url)
			const course = normalizeCourse(response)
			const lessons = (response.lessons ?? [])
				.map((lesson) => normalizeLesson(lesson, course.slug))
				.sort((a, b) => a.order - b.order)

			return {
				...course,
				enrollmentContentVersion:
					response.enrollmentContentVersion ??
					response.enrollment_content_version ??
					null,
				latestContentVersion:
					response.latestContentVersion ?? response.latest_content_version ?? 1,
				hasUpdatedContent:
					response.hasUpdatedContent ?? response.has_updated_content ?? false,
				lessons,
				prerequisites: normalizePrerequisites(response),
			}
		},
		enabled: Boolean(idOrSlug),
		staleTime: 60 * 1000,
		retry: false,
	})

	return {
		course: query.data ?? null,
		isLoading: query.isLoading,
		error: query.error instanceof Error ? query.error.message : null,
		refetch: query.refetch,
	}
}

const normalizePrerequisites = (
	course: ApiCourse,
): CoursePrerequisite[] | undefined => {
	const raw = course.prerequisites ?? course.prerequisite_courses
	if (!Array.isArray(raw) || raw.length === 0) return undefined
	const result = raw
		.map((item) => {
			const slug = String(item.slug ?? item.course_slug ?? item.id ?? "").trim()
			const id = String(item.id ?? item.course_id ?? slug).trim()
			const title = String(item.title ?? item.course_title ?? slug).trim()
			if (!id || !slug || !title) return null
			return { id, slug, title }
		})
		.filter((item): item is CoursePrerequisite => item !== null)
	return result.length > 0 ? result : undefined
}
