import { type Request, type Response } from "express"
import sanitizeHtml from "sanitize-html"
import { pool } from "../db"

type CourseRow = {
	id: number
	slug: string
	title: string
	description: string
	cover_image_url: string | null
	track: string
	difficulty: "beginner" | "intermediate" | "advanced"
	published_at: string | null
	created_at: string
	updated_at: string
	students_count: number
}

type LessonRow = {
	id: number
	course_id: number
	title: string
	content_markdown: string
	order_index: number
	estimated_minutes: number
	is_milestone: boolean
	created_at: string
	updated_at: string
	quiz: Array<{
		question: string
		options: string[]
		correctIndex: number
	}>
}

const toCourse = (row: CourseRow) => ({
	id: row.id,
	slug: row.slug,
	title: row.title,
	description: row.description,
	coverImage: row.cover_image_url,
	track: row.track,
	difficulty: row.difficulty,
	published: Boolean(row.published_at),
	createdAt: row.created_at,
	updatedAt: row.updated_at,
	studentsCount: Number(row.students_count ?? 0),
})

const toLesson = (row: LessonRow) => ({
	id: row.id,
	courseId: row.course_id,
	title: row.title,
	content: row.content_markdown,
	order: row.order_index,
	estimatedMinutes: Number(row.estimated_minutes ?? 10),
	isMilestone: row.is_milestone,
	quiz: row.quiz ?? [],
	createdAt: row.created_at,
	updatedAt: row.updated_at,
})

const difficultyValues = new Set(["beginner", "intermediate", "advanced"])

export const getCourses = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const track =
			typeof req.query.track === "string" ? req.query.track.trim() : undefined
		const search =
			typeof req.query.search === "string" ? req.query.search.trim() : undefined
		const includeUnpublished =
			typeof req.query.includeUnpublished === "string" &&
			["1", "true", "yes"].includes(
				req.query.includeUnpublished.trim().toLowerCase(),
			)
		const difficulty =
			typeof req.query.difficulty === "string"
				? req.query.difficulty.trim().toLowerCase()
				: undefined

		const pageParam =
			typeof req.query.page === "string"
				? Number.parseInt(req.query.page, 10)
				: 1

		const limitParam =
			typeof req.query.limit === "string"
				? Number.parseInt(req.query.limit, 10)
				: 12

		const offsetParam =
			typeof req.query.offset === "string"
				? Number.parseInt(req.query.offset, 10)
				: undefined

		const limit =
			Number.isFinite(limitParam) && limitParam > 0
				? Math.min(limitParam, 50)
				: 12

		let offset = 0
		let page = 1

		if (
			offsetParam !== undefined &&
			Number.isFinite(offsetParam) &&
			offsetParam >= 0
		) {
			offset = offsetParam
			page = Math.floor(offset / limit) + 1
		} else {
			page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
			offset = (page - 1) * limit
		}

		const conditions: string[] = []
		const params: unknown[] = []

		if (!includeUnpublished) {
			conditions.push("c.published_at IS NOT NULL")
		}

		if (track) {
			params.push(track)
			conditions.push(`LOWER(c.track) = LOWER($${params.length})`)
		}

		if (search) {
			params.push(`%${search}%`)
			conditions.push(
				`(c.title ILIKE $${params.length} OR c.description ILIKE $${params.length})`,
			)
		}

		if (difficulty) {
			if (!difficultyValues.has(difficulty)) {
				res.status(200).json({
					data: [],
					pagination: { page, limit, total: 0 },
				})
				return
			}
			params.push(difficulty)
			conditions.push(`c.difficulty = $${params.length}`)
		}

		const whereClause =
			conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

		// Snapshot filter params so COUNT is not affected when LIMIT/OFFSET are appended.
		const countParams = [...params]
		const totalResult = (await pool.query(
			`SELECT COUNT(*) AS count FROM courses c ${whereClause}`,
			countParams,
		)) as { rows: Array<{ count: string }> }
		const total = Number.parseInt(totalResult.rows[0]?.count ?? "0", 10)
		const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

		params.push(limit)
		params.push(offset)
		const rowsResult = (await pool.query(
			`SELECT
				c.id,
				c.slug,
				c.title,
				c.description,
				c.cover_image_url,
				c.track,
				c.difficulty,
				c.published_at,
				c.created_at,
				c.updated_at,
				COUNT(DISTINCT e.learner_address)::int AS students_count
			 FROM courses c
			 LEFT JOIN enrollments e ON e.course_id = c.slug
			 ${whereClause}
			 GROUP BY c.id, c.slug, c.title, c.description, c.cover_image_url, c.track, c.difficulty, c.published_at, c.created_at, c.updated_at
			 ORDER BY c.created_at DESC
			 LIMIT $${params.length - 1} OFFSET $${params.length}`,
			params,
		)) as { rows: CourseRow[] }

		res.status(200).json({
			data: rowsResult.rows.map(toCourse),
			pagination: { page, limit, total },
		})
	} catch {
		res.status(500).json({ error: "Internal server error" })
	}
}

export const getCourse = async (req: Request, res: Response): Promise<void> => {
	try {
		const idOrSlug = req.params.idOrSlug
		const isNumericId = /^\d+$/.test(idOrSlug)

		const query = isNumericId
			? `SELECT id, slug, title, description, cover_image_url, track, difficulty, published_at, created_at, updated_at
			   FROM courses
			   WHERE id = $1 AND published_at IS NOT NULL
			   LIMIT 1`
			: `SELECT id, slug, title, description, cover_image_url, track, difficulty, published_at, created_at, updated_at
			   FROM courses
			   WHERE slug = $1 AND published_at IS NOT NULL
			   LIMIT 1`

		const courseResult = (await pool.query(query, [
			isNumericId ? Number.parseInt(idOrSlug, 10) : idOrSlug,
		])) as { rows: CourseRow[] }

		const course = courseResult.rows[0]
		if (!course) {
			res.status(404).json({ error: "Course not found" })
			return
		}

		const lessonResult = (await pool.query(
			`SELECT
				l.id,
				l.course_id,
				l.title,
				l.content_markdown,
				l.order_index,
				l.estimated_minutes,
				BOOL_OR(m.id IS NOT NULL) AS is_milestone,
				l.created_at,
				l.updated_at,
				COALESCE(
					json_agg(
						json_build_object(
							'question', qq.question_text,
							'options', qq.options,
							'correctIndex', qq.correct_index
						)
						ORDER BY qq.id
					) FILTER (WHERE qq.id IS NOT NULL),
					'[]'::json
				) AS quiz
			 FROM lessons l
			 LEFT JOIN milestones m ON m.lesson_id = l.id
			 LEFT JOIN quizzes q ON q.lesson_id = l.id
			 LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
			 WHERE l.course_id = $1
			 GROUP BY l.id
			 ORDER BY l.order_index ASC`,
			[course.id],
		)) as { rows: LessonRow[] }

		res.status(200).json({
			...toCourse(course),
			lessons: lessonResult.rows.map(toLesson),
		})
	} catch {
		res.status(500).json({ error: "Internal server error" })
	}
}

export const getCourseLessonById = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const lessonId = Number.parseInt(req.params.id, 10)
		if (!Number.isInteger(lessonId) || lessonId <= 0) {
			res.status(404).json({ error: "Lesson not found" })
			return
		}

		const idOrSlug = req.params.idOrSlug
		const isNumericId = /^\d+$/.test(idOrSlug)

		const result = (await pool.query(
			`SELECT
				l.id,
				l.course_id,
				l.title,
				l.content_markdown,
				l.order_index,
				l.estimated_minutes,
				BOOL_OR(m.id IS NOT NULL) AS is_milestone,
				l.created_at,
				l.updated_at,
				COALESCE(
					json_agg(
						json_build_object(
							'question', qq.question_text,
							'options', qq.options,
							'correctIndex', qq.correct_index
						)
						ORDER BY qq.id
					) FILTER (WHERE qq.id IS NOT NULL),
					'[]'::json
				) AS quiz
			 FROM lessons l
			 INNER JOIN courses c ON c.id = l.course_id
			 LEFT JOIN milestones m ON m.lesson_id = l.id
			 LEFT JOIN quizzes q ON q.lesson_id = l.id
			 LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
			 WHERE ${isNumericId ? "c.id" : "c.slug"} = $1
			   AND c.published_at IS NOT NULL
			   AND l.id = $2
			 GROUP BY l.id
			 LIMIT 1`,
			[isNumericId ? Number.parseInt(idOrSlug, 10) : idOrSlug, lessonId],
		)) as { rows: LessonRow[] }

		const lesson = result.rows[0]
		if (!lesson) {
			res.status(404).json({ error: "Lesson not found" })
			return
		}

		res.status(200).json(toLesson(lesson))
	} catch {
		res.status(500).json({ error: "Internal server error" })
	}
}

export const createCourse = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const body = req.body as {
			title?: unknown
			slug?: unknown
			description?: unknown
			coverImage?: unknown
			track?: unknown
			difficulty?: unknown
		}

		for (const field of ["title", "slug", "track", "difficulty"] as const) {
			const value = body[field]
			if (typeof value !== "string" || value.trim().length === 0) {
				res.status(400).json({ error: `${field} is required`, field })
				return
			}
		}

		// Validate and sanitize description
		let description = ""
		if (body.description) {
			if (typeof body.description !== "string") {
				res.status(400).json({ error: "description must be a string", field: "description" })
				return
			}
			if (body.description.length > 2000) {
				res.status(400).json({ error: "description must be 2000 characters or fewer", field: "description" })
				return
			}
			description = sanitizeHtml(body.description, {
				allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
				allowedAttributes: {},
			})
		}

		// Sanitize title
		const title = sanitizeHtml(String(body.title).trim(), {
			allowedTags: [],
			allowedAttributes: {},
		})

		const difficulty = String(body.difficulty).toLowerCase()
		if (!difficultyValues.has(difficulty)) {
			res.status(400).json({ error: "Invalid difficulty", field: "difficulty" })
			return
		}

		const insert = (await pool.query(
			`INSERT INTO courses (title, slug, description, cover_image_url, track, difficulty, published_at)
			 VALUES ($1, $2, $3, $4, $5, $6, NULL)
			 RETURNING id, slug, title, description, cover_image_url, track, difficulty, published_at, created_at, updated_at`,
			[
				title,
				String(body.slug).trim(),
				description,
				typeof body.coverImage === "string" ? body.coverImage : null,
				String(body.track).trim(),
				difficulty,
			],
		)) as { rows: CourseRow[] }

		res.status(201).json(toCourse(insert.rows[0]))
	} catch (error) {
		if (typeof error === "object" && error && "code" in error) {
			const code = (error as { code?: string }).code
			if (code === "23505") {
				res.status(409).json({ error: "Slug already exists" })
				return
			}
		}
		res.status(500).json({ error: "Internal server error" })
	}
}

export const updateCourse = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const id = Number.parseInt(req.params.id, 10)
		if (!Number.isInteger(id) || id <= 0) {
			res.status(404).json({ error: "Course not found" })
			return
		}

		const existing = (await pool.query(
			`SELECT id FROM courses WHERE id = $1 LIMIT 1`,
			[id],
		)) as { rowCount: number; rows: Array<{ id: number }> }
		if (existing.rowCount === 0) {
			res.status(404).json({ error: "Course not found" })
			return
		}

		const body = req.body as Record<string, unknown>
		const values: unknown[] = []
		const setClauses: string[] = []

		const addField = (column: string, value: unknown) => {
			values.push(value)
			setClauses.push(`${column} = $${values.length}`)
		}

		if ("title" in body && typeof body.title === "string") {
			const sanitizedTitle = sanitizeHtml(body.title.trim(), {
				allowedTags: [],
				allowedAttributes: {},
			})
			addField("title", sanitizedTitle)
		}
		if ("slug" in body && typeof body.slug === "string") {
			addField("slug", body.slug.trim())
		}
		if ("description" in body && typeof body.description === "string") {
			if (body.description.length > 2000) {
				res.status(400).json({ error: "description must be 2000 characters or fewer", field: "description" })
				return
			}
			const sanitizedDescription = sanitizeHtml(body.description, {
				allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
				allowedAttributes: {},
			})
			addField("description", sanitizedDescription)
		}
		if ("coverImage" in body) {
			if (typeof body.coverImage === "string") {
				addField("cover_image_url", body.coverImage)
			} else if (body.coverImage === null) {
				addField("cover_image_url", null)
			}
		}
		if ("track" in body && typeof body.track === "string") {
			addField("track", body.track.trim())
		}
		if ("difficulty" in body && typeof body.difficulty === "string") {
			const difficulty = body.difficulty.toLowerCase()
			if (!difficultyValues.has(difficulty)) {
				res
					.status(400)
					.json({ error: "Invalid difficulty", field: "difficulty" })
				return
			}
			addField("difficulty", difficulty)
		}
		if ("published" in body && typeof body.published === "boolean") {
			if (body.published) {
				setClauses.push(
					`published_at = COALESCE(published_at, CURRENT_TIMESTAMP)`,
				)
			} else {
				setClauses.push(`published_at = NULL`)
			}
		}

		if (setClauses.length === 0) {
			res.status(400).json({ error: "No valid fields provided" })
			return
		}

		values.push(id)
		const result = (await pool.query(
			`UPDATE courses
			 SET ${setClauses.join(", ")}
			 WHERE id = $${values.length}
			 RETURNING id, slug, title, description, cover_image_url, track, difficulty, published_at, created_at, updated_at`,
			values,
		)) as { rows: CourseRow[] }

		res.status(200).json(toCourse(result.rows[0]))
	} catch (error) {
		if (typeof error === "object" && error && "code" in error) {
			const code = (error as { code?: string }).code
			if (code === "23505") {
				res.status(409).json({ error: "Slug already exists" })
				return
			}
		}
		res.status(500).json({ error: "Internal server error" })
	}
}
