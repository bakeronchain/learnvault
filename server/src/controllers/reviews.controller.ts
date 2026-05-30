import { type Request, type Response } from "express"
import sanitizeHtml from "sanitize-html"
import { pool } from "../db"
import { type AuthRequest } from "../middleware/auth.middleware"

type ReviewRow = {
	id: number
	course_id: number
	learner_address: string
	rating: number
	review_text: string | null
	created_at: string
}

const toReview = (row: ReviewRow) => ({
	id: row.id,
	courseId: row.course_id,
	learnerAddress: row.learner_address,
	rating: row.rating,
	reviewText: row.review_text ?? null,
	createdAt: row.created_at,
})

const resolveCourseId = async (idOrSlug: string): Promise<number | null> => {
	const isNumeric = /^\d+$/.test(idOrSlug)
	const result = (await pool.query(
		`SELECT id FROM courses WHERE ${isNumeric ? "id" : "slug"} = $1 AND published_at IS NOT NULL LIMIT 1`,
		[isNumeric ? Number.parseInt(idOrSlug, 10) : idOrSlug],
	)) as { rows: Array<{ id: number }> }
	return result.rows[0]?.id ?? null
}

export const getCourseReviews = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const courseId = await resolveCourseId(req.params.idOrSlug)
		if (courseId === null) {
			res.status(404).json({ error: "Course not found" })
			return
		}

		const limitParam = Number.parseInt(req.query.limit as string, 10)
		const offsetParam = Number.parseInt(req.query.offset as string, 10)
		const limit =
			Number.isFinite(limitParam) && limitParam > 0
				? Math.min(limitParam, 100)
				: 20
		const offset =
			Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0

		const [reviewsResult, statsResult] = await Promise.all([
			pool.query(
				`SELECT id, course_id, learner_address, rating, review_text, created_at
				 FROM course_reviews
				 WHERE course_id = $1
				 ORDER BY created_at DESC
				 LIMIT $2 OFFSET $3`,
				[courseId, limit, offset],
			) as Promise<{ rows: ReviewRow[] }>,
			pool.query(
				`SELECT COUNT(*)::int AS total, ROUND(AVG(rating), 1) AS avg_rating
				 FROM course_reviews
				 WHERE course_id = $1`,
				[courseId],
			) as Promise<{
				rows: Array<{ total: number; avg_rating: string | null }>
			}>,
		])

		const { total, avg_rating } = statsResult.rows[0]

		res.status(200).json({
			data: reviewsResult.rows.map(toReview),
			total,
			avgRating: avg_rating !== null ? Number(avg_rating) : null,
		})
	} catch {
		res.status(500).json({ error: "Internal server error" })
	}
}

export const createCourseReview = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const learnerAddress = (req as AuthRequest).user?.address
		if (!learnerAddress) {
			res.status(401).json({ error: "Unauthorized" })
			return
		}

		const courseId = await resolveCourseId(req.params.idOrSlug)
		if (courseId === null) {
			res.status(404).json({ error: "Course not found" })
			return
		}

		// Must be enrolled in course to review
		const enrollment = (await pool.query(
			`SELECT id FROM enrollments
			 WHERE learner_address = $1
			   AND course_id = (SELECT slug FROM courses WHERE id = $2 LIMIT 1)
			 LIMIT 1`,
			[learnerAddress, courseId],
		)) as { rows: Array<{ id: number }> }

		if (enrollment.rows.length === 0) {
			res
				.status(403)
				.json({
					error: "You must be enrolled in this course to leave a review",
				})
			return
		}

		const body = req.body as { rating?: unknown; reviewText?: unknown }

		const rating = Number(body.rating)
		if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
			res
				.status(400)
				.json({
					error: "rating must be an integer between 1 and 5",
					field: "rating",
				})
			return
		}

		let reviewText: string | null = null
		if (body.reviewText !== undefined && body.reviewText !== null) {
			if (typeof body.reviewText !== "string") {
				res
					.status(400)
					.json({ error: "reviewText must be a string", field: "reviewText" })
				return
			}
			if (body.reviewText.length > 2000) {
				res
					.status(400)
					.json({
						error: "reviewText must be 2000 characters or fewer",
						field: "reviewText",
					})
				return
			}
			reviewText =
				sanitizeHtml(body.reviewText.trim(), {
					allowedTags: [],
					allowedAttributes: {},
				}) || null
		}

		const result = (await pool.query(
			`INSERT INTO course_reviews (course_id, learner_address, rating, review_text)
			 VALUES ($1, $2, $3, $4)
			 RETURNING id, course_id, learner_address, rating, review_text, created_at`,
			[courseId, learnerAddress, rating, reviewText],
		)) as { rows: ReviewRow[] }

		res.status(201).json(toReview(result.rows[0]))
	} catch (error) {
		if (typeof error === "object" && error && "code" in error) {
			if ((error as { code?: string }).code === "23505") {
				res.status(409).json({ error: "You have already reviewed this course" })
				return
			}
		}
		res.status(500).json({ error: "Internal server error" })
	}
}
