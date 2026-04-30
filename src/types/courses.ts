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
}

export interface CourseDetail extends CourseSummary {
	lessons: CourseLesson[]
}
