import { type Request, type Response } from "express"

const COURSES = [
	{
		id: "stellar-basics",
		title: "Stellar Basics",
		level: "beginner",
		published: true,
	},
	{
		id: "soroban-fundamentals",
		title: "Soroban Fundamentals",
		level: "intermediate",
		published: true,
	},
] as const

export const getCourses = (_req: Request, res: Response): void => {
	res.status(200).json({
		data: COURSES,
	})
}

export const getCourseById = (req: Request, res: Response): void => {
	const course = COURSES.find((item) => item.id === req.params.courseId)

	if (!course) {
		res.status(404).json({
			error: "Course not found",
		})
		return
	}

	res.status(200).json({
		data: course,
	})
}
