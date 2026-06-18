export type CourseDifficulty = "beginner" | "intermediate" | "advanced"

export type CourseLevel = "Beginner" | "Intermediate" | "Advanced"

export interface CourseLesson {
	id: number
	courseId: string
	title: string
	content: string
	order: number
	estimatedMinutes: number
	isMilestone: boolean
	version?: number
	isLatest?: boolean
	changeSummary?: string | null
}

export interface CoursePrerequisite {
	id: string
	slug: string
	title: string
}

export interface CourseRatingSummary {
	average: number
	count: number
}

export interface CourseReview {
	id: string
	courseId: string
	walletAddress: string
	rating: number
	text: string
	createdAt: string
	updatedAt?: string
	isOwn?: boolean
}

export interface CourseSummary {
	id: string
	slug: string
	title: string
	description: string
	coverImage: string | null
	track: string
	trackKey: string
	difficulty: CourseDifficulty
	level: CourseLevel
	published: boolean
	createdAt: string
	updatedAt: string
	accentClassName: string
	ratingSummary?: CourseRatingSummary | null
}

export interface CourseDetail extends CourseSummary {
	enrollmentContentVersion?: number | null
	latestContentVersion?: number
	hasUpdatedContent?: boolean
	lessons: CourseLesson[]
	prerequisites?: CoursePrerequisite[]
}
