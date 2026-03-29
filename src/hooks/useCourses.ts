import { useQuery } from "@tanstack/react-query"
import {
	type CourseDetail,
	type CourseDifficulty,
	type CourseLesson,
	type CourseLevel,
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
	isMilestone?: boolean
	is_milestone?: boolean
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
	isMilestone: Boolean(lesson.isMilestone ?? lesson.is_milestone),
})

async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url, {
		headers: {
			"Content-Type": "application/json",
		},
	})

	if (!response.ok) {
		const error = await response.json().catch(() => ({}))
		throw new Error(
			(error as { error?: string }).error || `Request failed for ${url}`,
		)
	}

	return response.json() as Promise<T>
}

export function useCourses() {
	const query = useQuery({
		queryKey: ["courses"],
		queryFn: async (): Promise<CourseSummary[]> => {
			const response = await fetchJson<CourseListResponse | ApiCourse[]>(
				"/api/courses",
			)
			const courses = Array.isArray(response) ? response : (response.data ?? [])
			return courses.map(normalizeCourse)
		},
		staleTime: 5 * 60 * 1000,
	})

	return {
		courses: query.data ?? [],
		isLoading: query.isLoading,
		error: query.error instanceof Error ? query.error.message : null,
		refetch: query.refetch,
	}
}

export function useCourseDetail(idOrSlug: string | undefined) {
	const query = useQuery({
		queryKey: ["course", idOrSlug],
		queryFn: async (): Promise<CourseDetail> => {
			const response = await fetchJson<ApiCourse & { lessons?: ApiLesson[] }>(
				`/api/courses/${idOrSlug}`,
			)
			const course = normalizeCourse(response)
			const lessons = (response.lessons ?? [])
				.map((lesson) => normalizeLesson(lesson, course.slug))
				.sort((a, b) => a.order - b.order)

			return {
				...course,
				lessons,
			}
		},
		enabled: Boolean(idOrSlug),
		staleTime: 5 * 60 * 1000,
		retry: false,
	})

	return {
		course: query.data ?? null,
		isLoading: query.isLoading,
		error: query.error instanceof Error ? query.error.message : null,
		refetch: query.refetch,
	}
}
