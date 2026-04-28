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
	version: number
	is_active: boolean
	change_summary: string | null
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
	version: Number(row.version ?? 1),
	isLatest: Boolean(row.is_active),
	changeSummary: row.change_summary,
	quiz: row.quiz ?? [],
	createdAt: row.created_at,
	updatedAt: row.updated_at,
})

const difficultyValues = new Set(["beginner", "intermediate", "advanced"])

function parseOptionalLearnerAddress(req: Request): string | null {
	const learnerAddress =
		typeof req.query.learner_address === "string"
			? req.query.learner_address.trim()
			: ""
	return learnerAddress.length > 0 ? learnerAddress : null
}

function buildSimpleLineDiff(
	before: string,
	after: string,
): {
	addedLines: string[]
	removedLines: string[]
} {
	const beforeLines = before.split(/\r?\n/)
	const afterLines = after.split(/\r?\n/)

	const beforeSet = new Set(beforeLines)
	const afterSet = new Set(afterLines)

	const removedLines = beforeLines.filter((line) => !afterSet.has(line))
	const addedLines = afterLines.filter((line) => !beforeSet.has(line))

	return { addedLines, removedLines }
}

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
			params.push(true)
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
					page,
					limit,
					total: 0,
					totalPages: 0,
				})
				return
			}
			params.push(difficulty)
			conditions.push(`c.difficulty = $${params.length}`)
		}

		const whereClause =
			conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

		const totalResult = (await pool.query(
			`SELECT COUNT(*) AS count FROM courses c ${whereClause}`,
			params,
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
			page,
			limit,
			total,
			totalPages,
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

		const latestVersionResult = (await pool.query(
			`SELECT COALESCE(MAX(version), 1)::int AS latest_version
			 FROM lessons
			 WHERE course_id = $1`,
			[course.id],
		)) as { rows: Array<{ latest_version: number }> }

		const latestContentVersion = Number(
			latestVersionResult.rows[0]?.latest_version ?? 1,
		)
		const learnerAddress = parseOptionalLearnerAddress(req)
		let enrollmentContentVersion: number | null = null

		if (learnerAddress) {
			const enrollmentVersionResult = (await pool.query(
				`SELECT content_version
				 FROM enrollments
				 WHERE learner_address = $1
				   AND course_id = $2
				 LIMIT 1`,
				[learnerAddress, course.slug],
			)) as { rows: Array<{ content_version: number | null }> }

			const maybeVersion = enrollmentVersionResult.rows[0]?.content_version
			if (typeof maybeVersion === "number" && Number.isFinite(maybeVersion)) {
				enrollmentContentVersion = maybeVersion
			}
		}

		const effectiveVersion = enrollmentContentVersion ?? latestContentVersion

		const lessonResult = (await pool.query(
			`WITH selected_lessons AS (
				SELECT
					order_index,
					MAX(version)::int AS version
				FROM lessons
				WHERE course_id = $1
				  AND version <= $2
				GROUP BY order_index
			)
			 SELECT
				l.id,
				l.course_id,
				l.title,
				l.content_markdown,
				l.order_index,
				l.estimated_minutes,
				BOOL_OR(m.id IS NOT NULL) AS is_milestone,
				l.version,
				l.is_active,
				l.change_summary,
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
			 INNER JOIN selected_lessons sl
			   ON sl.order_index = l.order_index
			  AND sl.version = l.version
			 LEFT JOIN milestones m ON m.lesson_id = l.id
			 LEFT JOIN quizzes q ON q.lesson_id = l.id
			 LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
			 WHERE l.course_id = $1
			 GROUP BY l.id
			 ORDER BY l.order_index ASC`,
			[course.id, effectiveVersion],
		)) as { rows: LessonRow[] }

		res.status(200).json({
			...toCourse(course),
			enrollmentContentVersion,
			latestContentVersion,
			hasUpdatedContent:
				enrollmentContentVersion !== null &&
				enrollmentContentVersion < latestContentVersion,
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
				l.version,
				l.is_active,
				l.change_summary,
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

export const updateLessonVersion = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const orderIndex = Number.parseInt(req.params.orderIndex, 10)
	if (!Number.isInteger(orderIndex) || orderIndex < 1) {
		res.status(400).json({ error: "orderIndex must be a positive integer" })
		return
	}

	const body = req.body as {
		title?: unknown
		content?: unknown
		content_markdown?: unknown
		estimatedMinutes?: unknown
		estimated_minutes?: unknown
		changeSummary?: unknown
		change_summary?: unknown
		isMilestone?: unknown
		is_milestone?: unknown
	}

	const nextTitle =
		typeof body.title === "string"
			? sanitizeHtml(body.title.trim(), {
					allowedTags: [],
					allowedAttributes: {},
				})
			: undefined
	const nextContent =
		typeof body.content_markdown === "string"
			? body.content_markdown
			: typeof body.content === "string"
				? body.content
				: undefined
	const nextEstimatedMinutesRaw =
		body.estimated_minutes ?? body.estimatedMinutes
	const nextEstimatedMinutes =
		typeof nextEstimatedMinutesRaw === "number" &&
		Number.isInteger(nextEstimatedMinutesRaw) &&
		nextEstimatedMinutesRaw > 0
			? nextEstimatedMinutesRaw
			: undefined
	const nextChangeSummaryRaw = body.change_summary ?? body.changeSummary
	const nextChangeSummary =
		typeof nextChangeSummaryRaw === "string"
			? nextChangeSummaryRaw.trim()
			: nextChangeSummaryRaw === null
				? null
				: undefined
	const nextIsMilestoneRaw = body.is_milestone ?? body.isMilestone
	const nextIsMilestone =
		typeof nextIsMilestoneRaw === "boolean" ? nextIsMilestoneRaw : undefined

	if (
		nextTitle === undefined &&
		nextContent === undefined &&
		nextEstimatedMinutes === undefined &&
		nextChangeSummary === undefined &&
		nextIsMilestone === undefined
	) {
		res.status(400).json({
			error:
				"Provide at least one field to version: title, content/content_markdown, estimatedMinutes/estimated_minutes, changeSummary/change_summary, or isMilestone/is_milestone",
		})
		return
	}

	if (nextTitle !== undefined && nextTitle.length === 0) {
		res.status(400).json({ error: "title cannot be empty" })
		return
	}

	const idOrSlug = req.params.idOrSlug
	const isNumericId = /^\d+$/.test(idOrSlug)

	const client = await pool.connect()
	try {
		await client.query("BEGIN")

		const courseResult = (await client.query(
			`SELECT id, slug
			 FROM courses
			 WHERE ${isNumericId ? "id = $1" : "slug = $1"}
			 LIMIT 1`,
			[isNumericId ? Number.parseInt(idOrSlug, 10) : idOrSlug],
		)) as { rows: Array<{ id: number; slug: string }> }

		const course = courseResult.rows[0]
		if (!course) {
			await client.query("ROLLBACK")
			res.status(404).json({ error: "Course not found" })
			return
		}

		const currentLessonResult = (await client.query(
			`SELECT id, title, content_markdown, estimated_minutes, version, order_index
			 FROM lessons
			 WHERE course_id = $1
			   AND order_index = $2
			   AND is_active = TRUE
			 ORDER BY version DESC
			 LIMIT 1
			 FOR UPDATE`,
			[course.id, orderIndex],
		)) as {
			rows: Array<{
				id: number
				title: string
				content_markdown: string
				estimated_minutes: number
				version: number
				order_index: number
			}>
		}

		const currentLesson = currentLessonResult.rows[0]
		if (!currentLesson) {
			await client.query("ROLLBACK")
			res.status(404).json({ error: "Active lesson version not found" })
			return
		}

		const milestoneRows = (await client.query(
			`SELECT id
			 FROM milestones
			 WHERE course_id = $1
			   AND lesson_id = $2
			 ORDER BY id ASC`,
			[course.id, currentLesson.id],
		)) as { rows: Array<{ id: number }> }

		const resolvedIsMilestone = nextIsMilestone ?? milestoneRows.rows.length > 0

		await client.query(
			`UPDATE lessons
			 SET is_active = FALSE,
			     superseded_at = CURRENT_TIMESTAMP
			 WHERE id = $1`,
			[currentLesson.id],
		)

		const insertedLessonResult = (await client.query(
			`INSERT INTO lessons (
				course_id,
				order_index,
				title,
				content_markdown,
				estimated_minutes,
				version,
				is_active,
				change_summary
			 )
			 VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
			 RETURNING
				id,
				course_id,
				title,
				content_markdown,
				order_index,
				estimated_minutes,
				version,
				is_active,
				change_summary,
				created_at,
				updated_at`,
			[
				course.id,
				orderIndex,
				nextTitle ?? currentLesson.title,
				nextContent ?? currentLesson.content_markdown,
				nextEstimatedMinutes ?? currentLesson.estimated_minutes,
				Number(currentLesson.version) + 1,
				nextChangeSummary === undefined ? null : nextChangeSummary,
			],
		)) as { rows: LessonRow[] }

		const insertedLesson = insertedLessonResult.rows[0]

		await client.query(
			`UPDATE lessons
			 SET superseded_by = $1
			 WHERE id = $2`,
			[insertedLesson.id, currentLesson.id],
		)

		if (resolvedIsMilestone && milestoneRows.rows.length > 0) {
			await client.query(
				`UPDATE milestones
				 SET lesson_id = $1
				 WHERE course_id = $2
				   AND lesson_id = $3`,
				[insertedLesson.id, course.id, currentLesson.id],
			)
		} else if (!resolvedIsMilestone && milestoneRows.rows.length > 0) {
			await client.query(
				`UPDATE milestones
				 SET lesson_id = NULL
				 WHERE course_id = $1
				   AND lesson_id = $2`,
				[course.id, currentLesson.id],
			)
		}

		const quizResult = (await client.query(
			`SELECT id, passing_score
			 FROM quizzes
			 WHERE lesson_id = $1
			 LIMIT 1`,
			[currentLesson.id],
		)) as { rows: Array<{ id: number; passing_score: number }> }
		const existingQuiz = quizResult.rows[0]

		if (existingQuiz) {
			const insertedQuizResult = (await client.query(
				`INSERT INTO quizzes (lesson_id, passing_score)
				 VALUES ($1, $2)
				 RETURNING id`,
				[insertedLesson.id, existingQuiz.passing_score],
			)) as { rows: Array<{ id: number }> }
			const insertedQuizId = insertedQuizResult.rows[0]?.id

			if (insertedQuizId) {
				await client.query(
					`INSERT INTO quiz_questions (
						quiz_id,
						question_text,
						options,
						correct_index,
						explanation
					 )
					 SELECT
						$1,
						question_text,
						options,
						correct_index,
						explanation
					 FROM quiz_questions
					 WHERE quiz_id = $2
					 ORDER BY id ASC`,
					[insertedQuizId, existingQuiz.id],
				)
			}
		}

		await client.query("COMMIT")

		res.status(200).json({
			course_id: course.slug,
			order_index: orderIndex,
			superseded_version: currentLesson.version,
			lesson: toLesson({
				...insertedLesson,
				quiz: [],
				is_milestone: resolvedIsMilestone,
			}),
		})
	} catch {
		await client.query("ROLLBACK")
		res.status(500).json({ error: "Internal server error" })
	} finally {
		client.release()
	}
}

export const getLessonVersionDiff = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const idOrSlug = req.params.idOrSlug
		const orderIndex = Number.parseInt(req.params.orderIndex, 10)
		const fromVersion = Number.parseInt(String(req.query.fromVersion ?? ""), 10)
		const toVersion = Number.parseInt(String(req.query.toVersion ?? ""), 10)

		if (
			!Number.isInteger(orderIndex) ||
			orderIndex < 1 ||
			!Number.isInteger(fromVersion) ||
			fromVersion < 1 ||
			!Number.isInteger(toVersion) ||
			toVersion < 1
		) {
			res.status(400).json({
				error:
					"orderIndex path param and fromVersion/toVersion query params must be positive integers",
			})
			return
		}

		const isNumericId = /^\d+$/.test(idOrSlug)
		const courseResult = (await pool.query(
			`SELECT id, slug
			 FROM courses
			 WHERE ${isNumericId ? "id = $1" : "slug = $1"}
			 LIMIT 1`,
			[isNumericId ? Number.parseInt(idOrSlug, 10) : idOrSlug],
		)) as { rows: Array<{ id: number; slug: string }> }

		const course = courseResult.rows[0]
		if (!course) {
			res.status(404).json({ error: "Course not found" })
			return
		}

		const [fromResult, toResult] = await Promise.all([
			pool.query(
				`SELECT id, title, content_markdown, version, change_summary
				 FROM lessons
				 WHERE course_id = $1
				   AND order_index = $2
				   AND version = $3
				 LIMIT 1`,
				[course.id, orderIndex, fromVersion],
			),
			pool.query(
				`SELECT id, title, content_markdown, version, change_summary
				 FROM lessons
				 WHERE course_id = $1
				   AND order_index = $2
				   AND version = $3
				 LIMIT 1`,
				[course.id, orderIndex, toVersion],
			),
		])

		const fromLesson = fromResult.rows[0]
		const toLesson = toResult.rows[0]

		if (!fromLesson || !toLesson) {
			res
				.status(404)
				.json({ error: "One or both lesson versions were not found" })
			return
		}

		const { addedLines, removedLines } = buildSimpleLineDiff(
			String(fromLesson.content_markdown ?? ""),
			String(toLesson.content_markdown ?? ""),
		)

		res.status(200).json({
			course_id: course.slug,
			order_index: orderIndex,
			from: {
				version: fromLesson.version,
				title: fromLesson.title,
				change_summary: fromLesson.change_summary,
			},
			to: {
				version: toLesson.version,
				title: toLesson.title,
				change_summary: toLesson.change_summary,
			},
			diff: {
				added_lines: addedLines,
				removed_lines: removedLines,
				added_count: addedLines.length,
				removed_count: removedLines.length,
			},
		})
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
				res
					.status(400)
					.json({ error: "description must be a string", field: "description" })
				return
			}
			if (body.description.length > 2000) {
				res.status(400).json({
					error: "description must be 2000 characters or fewer",
					field: "description",
				})
				return
			}
			description = sanitizeHtml(body.description, {
				allowedTags: ["p", "br", "strong", "em", "ul", "ol", "li"],
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
				res.status(400).json({
					error: "description must be 2000 characters or fewer",
					field: "description",
				})
				return
			}
			const sanitizedDescription = sanitizeHtml(body.description, {
				allowedTags: ["p", "br", "strong", "em", "ul", "ol", "li"],
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
