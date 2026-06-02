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

type Course = (typeof COURSES)[number]

/** Encode a course ID into an opaque base64 cursor token */
function encodeCursor(id: string): string {
	return Buffer.from(id).toString("base64url")
}

/** Decode a cursor token back to a course ID, returns null on invalid input */
function decodeCursor(token: string): string | null {
	try {
		return Buffer.from(token, "base64url").toString("utf8")
	} catch {
		return null
	}
}

export const getCourses = (req: Request, res: Response): void => {
	const limit = (req.query.limit as number | undefined) ?? 20
	const cursorToken = req.query.cursor as string | undefined

	const published = COURSES.filter((c) => c.published)

	let startIndex = 0
	if (cursorToken) {
		const cursorId = decodeCursor(cursorToken)
		if (cursorId === null) {
			res.status(400).json({ error: "Invalid cursor" })
			return
		}
		const cursorIndex = published.findIndex((c) => c.id === cursorId)
		if (cursorIndex === -1) {
			res.status(400).json({ error: "Cursor references an unknown course" })
			return
		}
		startIndex = cursorIndex + 1
	}

	const page = published.slice(startIndex, startIndex + limit) as Course[]
	const hasMore = startIndex + limit < published.length
	const nextCursor = hasMore
		? encodeCursor(published[startIndex + limit - 1].id)
		: null

	res.status(200).json({
		data: page,
		nextCursor,
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
