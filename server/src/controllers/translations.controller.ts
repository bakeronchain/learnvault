import { type Request, type Response } from "express"
import jwt from "jsonwebtoken"

import { pool } from "../db"
import { invalidateApiResponseCacheType } from "../lib/api-response-cache"
import { SUPPORTED_CONTENT_LANGS } from "./courses.controller"

const SUPPORTED_LANGS = new Set<string>(SUPPORTED_CONTENT_LANGS)

function isSupportedLanguage(value: unknown): value is string {
	return typeof value === "string" && SUPPORTED_LANGS.has(value)
}

// Best-effort actor address for audit fields (reviewed_by/granted_by). Admin
// callers may authenticate via x-api-key, which has no address — null then.
function extractActorAddress(req: Request): string | null {
	const authHeader = req.headers.authorization
	if (!authHeader?.startsWith("Bearer ")) return null
	const token = authHeader.slice("Bearer ".length).trim()
	try {
		const decoded = jwt.decode(token) as {
			sub?: string
			address?: string
		} | null
		return decoded?.sub ?? decoded?.address ?? null
	} catch {
		return null
	}
}

async function resolveCourse(
	idOrSlug: string,
): Promise<{ id: number; slug: string; content_version: number } | null> {
	const isNumericId = /^\d+$/.test(idOrSlug)
	const result = (await pool.query(
		`SELECT id, slug, content_version FROM courses
		 WHERE ${isNumericId ? "id = $1" : "slug = $1"}
		 LIMIT 1`,
		[isNumericId ? Number.parseInt(idOrSlug, 10) : idOrSlug],
	)) as { rows: Array<{ id: number; slug: string; content_version: number }> }
	return result.rows[0] ?? null
}

const toCourseTranslation = (row: Record<string, unknown>) => ({
	id: row.id,
	courseId: row.course_id,
	languageCode: row.language_code,
	title: row.title,
	description: row.description,
	status: row.status,
	translatorAddress: row.translator_address,
	reviewedByAddress: row.reviewed_by_address ?? null,
	sourceVersion: row.source_version,
	isStale: Boolean(row.is_stale),
	publishedAt: row.published_at ?? null,
	updatedAt: row.updated_at,
})

const toLessonTranslation = (row: Record<string, unknown>) => ({
	id: row.id,
	courseId: row.course_id,
	orderIndex: row.order_index,
	languageCode: row.language_code,
	title: row.title,
	content: row.content_markdown,
	status: row.status,
	translatorAddress: row.translator_address,
	reviewedByAddress: row.reviewed_by_address ?? null,
	sourceVersion: row.source_version,
	isStale: Boolean(row.is_stale),
	publishedAt: row.published_at ?? null,
	updatedAt: row.updated_at,
})

// ---------------------------------------------------------------------------
// Glossary (do-not-translate terms)
// ---------------------------------------------------------------------------

export const listGlossaryTerms = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const course = await resolveCourse(req.params.idOrSlug)
		if (!course) {
			res.status(404).json({ error: "Course not found" })
			return
		}
		const result = await pool.query(
			`SELECT id, term, note FROM course_glossary_terms WHERE course_id = $1 ORDER BY term ASC`,
			[course.id],
		)
		res.status(200).json({ data: result.rows })
	} catch {
		res.status(500).json({ error: "Internal server error" })
	}
}

export const createGlossaryTerm = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const course = await resolveCourse(req.params.idOrSlug)
		if (!course) {
			res.status(404).json({ error: "Course not found" })
			return
		}
		const body = req.body as { term?: unknown; note?: unknown }
		if (typeof body.term !== "string" || body.term.trim().length === 0) {
			res.status(400).json({ error: "term is required", field: "term" })
			return
		}
		const result = await pool.query(
			`INSERT INTO course_glossary_terms (course_id, term, note)
			 VALUES ($1, $2, $3)
			 RETURNING id, term, note`,
			[
				course.id,
				body.term.trim(),
				typeof body.note === "string" ? body.note.trim() : null,
			],
		)
		res.status(201).json(result.rows[0])
	} catch (error) {
		if (typeof error === "object" && error && "code" in error) {
			const code = (error as { code?: string }).code
			if (code === "23505") {
				res.status(409).json({ error: "Term already exists for this course" })
				return
			}
		}
		res.status(500).json({ error: "Internal server error" })
	}
}

export const updateGlossaryTerm = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const course = await resolveCourse(req.params.idOrSlug)
		if (!course) {
			res.status(404).json({ error: "Course not found" })
			return
		}
		const termId = Number.parseInt(req.params.termId, 10)
		if (!Number.isInteger(termId) || termId <= 0) {
			res.status(404).json({ error: "Glossary term not found" })
			return
		}
		const body = req.body as { term?: unknown; note?: unknown }
		const setClauses: string[] = []
		const values: unknown[] = []
		if (typeof body.term === "string" && body.term.trim().length > 0) {
			values.push(body.term.trim())
			setClauses.push(`term = $${values.length}`)
		}
		if ("note" in body) {
			values.push(typeof body.note === "string" ? body.note.trim() : null)
			setClauses.push(`note = $${values.length}`)
		}
		if (setClauses.length === 0) {
			res.status(400).json({ error: "No valid fields provided" })
			return
		}
		values.push(course.id, termId)
		const result = await pool.query(
			`UPDATE course_glossary_terms
			 SET ${setClauses.join(", ")}
			 WHERE course_id = $${values.length - 1} AND id = $${values.length}
			 RETURNING id, term, note`,
			values,
		)
		if (result.rows.length === 0) {
			res.status(404).json({ error: "Glossary term not found" })
			return
		}
		res.status(200).json(result.rows[0])
	} catch {
		res.status(500).json({ error: "Internal server error" })
	}
}

export const deleteGlossaryTerm = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const course = await resolveCourse(req.params.idOrSlug)
		if (!course) {
			res.status(404).json({ error: "Course not found" })
			return
		}
		const termId = Number.parseInt(req.params.termId, 10)
		const result = (await pool.query(
			`DELETE FROM course_glossary_terms WHERE course_id = $1 AND id = $2`,
			[course.id, termId],
		)) as { rowCount: number }
		if (result.rowCount === 0) {
			res.status(404).json({ error: "Glossary term not found" })
			return
		}
		res.status(204).send()
	} catch {
		res.status(500).json({ error: "Internal server error" })
	}
}

// ---------------------------------------------------------------------------
// Translator grants
// ---------------------------------------------------------------------------

export const listTranslatorGrants = async (
	_req: Request,
	res: Response,
): Promise<void> => {
	try {
		const result = await pool.query(
			`SELECT id, wallet_address, language_code, granted_by, granted_at, revoked_at
			 FROM translator_grants
			 ORDER BY granted_at DESC`,
		)
		res.status(200).json({ data: result.rows })
	} catch {
		res.status(500).json({ error: "Internal server error" })
	}
}

export const grantTranslator = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const body = req.body as { walletAddress?: unknown; languageCode?: unknown }
		if (
			typeof body.walletAddress !== "string" ||
			body.walletAddress.trim().length === 0
		) {
			res.status(400).json({ error: "walletAddress is required" })
			return
		}
		if (!isSupportedLanguage(body.languageCode)) {
			res.status(400).json({
				error: `languageCode must be one of ${[...SUPPORTED_LANGS].join(", ")}`,
			})
			return
		}
		const grantedBy = extractActorAddress(req) ?? "admin"
		const result = await pool.query(
			`INSERT INTO translator_grants (wallet_address, language_code, granted_by)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (wallet_address, language_code)
			 DO UPDATE SET revoked_at = NULL, granted_by = EXCLUDED.granted_by, granted_at = CURRENT_TIMESTAMP
			 RETURNING id, wallet_address, language_code, granted_by, granted_at, revoked_at`,
			[body.walletAddress.trim(), body.languageCode, grantedBy],
		)
		res.status(201).json(result.rows[0])
	} catch {
		res.status(500).json({ error: "Internal server error" })
	}
}

export const revokeTranslator = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const id = Number.parseInt(req.params.id, 10)
		if (!Number.isInteger(id) || id <= 0) {
			res.status(404).json({ error: "Grant not found" })
			return
		}
		const result = (await pool.query(
			`UPDATE translator_grants SET revoked_at = CURRENT_TIMESTAMP
			 WHERE id = $1 AND revoked_at IS NULL`,
			[id],
		)) as { rowCount: number }
		if (result.rowCount === 0) {
			res.status(404).json({ error: "Grant not found" })
			return
		}
		res.status(204).send()
	} catch {
		res.status(500).json({ error: "Internal server error" })
	}
}

// ---------------------------------------------------------------------------
// Course translations
// ---------------------------------------------------------------------------

export const getCourseTranslationEditorState = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const course = await resolveCourse(req.params.idOrSlug)
		if (!course) {
			res.status(404).json({ error: "Course not found" })
			return
		}
		const languageCode = req.params.languageCode
		const [sourceResult, translationResult, glossaryResult] = await Promise.all(
			[
				pool.query(`SELECT title, description FROM courses WHERE id = $1`, [
					course.id,
				]),
				pool.query(
					`SELECT * FROM course_translations WHERE course_id = $1 AND language_code = $2`,
					[course.id, languageCode],
				),
				pool.query(
					`SELECT id, term, note FROM course_glossary_terms WHERE course_id = $1 ORDER BY term ASC`,
					[course.id],
				),
			],
		)
		res.status(200).json({
			source: {
				title: sourceResult.rows[0]?.title,
				description: sourceResult.rows[0]?.description,
				contentVersion: course.content_version,
			},
			translation: translationResult.rows[0]
				? toCourseTranslation(translationResult.rows[0])
				: null,
			glossary: glossaryResult.rows,
		})
	} catch {
		res.status(500).json({ error: "Internal server error" })
	}
}

export const saveCourseTranslationDraft = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const course = await resolveCourse(req.params.idOrSlug)
		if (!course) {
			res.status(404).json({ error: "Course not found" })
			return
		}
		const languageCode = req.params.languageCode
		const body = req.body as { title?: unknown; description?: unknown }
		if (typeof body.title !== "string" || body.title.trim().length === 0) {
			res.status(400).json({ error: "title is required", field: "title" })
			return
		}
		if (typeof body.description !== "string") {
			res
				.status(400)
				.json({ error: "description is required", field: "description" })
			return
		}
		const translatorAddress = req.translatorContext?.address ?? "admin"
		const result = await pool.query(
			`INSERT INTO course_translations
				(course_id, language_code, title, description, status, translator_address, source_version, is_stale)
			 VALUES ($1, $2, $3, $4, 'draft', $5, $6, FALSE)
			 ON CONFLICT (course_id, language_code) DO UPDATE
			 SET title = EXCLUDED.title,
			     description = EXCLUDED.description,
			     translator_address = EXCLUDED.translator_address,
			     source_version = EXCLUDED.source_version,
			     is_stale = FALSE
			 RETURNING *`,
			[
				course.id,
				languageCode,
				body.title.trim(),
				body.description,
				translatorAddress,
				course.content_version,
			],
		)
		void invalidateApiResponseCacheType("courses")
		res.status(200).json(toCourseTranslation(result.rows[0]))
	} catch {
		res.status(500).json({ error: "Internal server error" })
	}
}

export const submitCourseTranslationForReview = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const course = await resolveCourse(req.params.idOrSlug)
		if (!course) {
			res.status(404).json({ error: "Course not found" })
			return
		}
		const languageCode = req.params.languageCode
		const result = await pool.query(
			`UPDATE course_translations
			 SET status = 'in_review'
			 WHERE course_id = $1 AND language_code = $2 AND (status = 'draft' OR is_stale = TRUE)
			 RETURNING *`,
			[course.id, languageCode],
		)
		if (result.rows.length === 0) {
			res.status(400).json({
				error: "No draft or stale translation is available to submit",
			})
			return
		}
		void invalidateApiResponseCacheType("courses")
		res.status(200).json(toCourseTranslation(result.rows[0]))
	} catch {
		res.status(500).json({ error: "Internal server error" })
	}
}

export const publishCourseTranslation = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const course = await resolveCourse(req.params.idOrSlug)
		if (!course) {
			res.status(404).json({ error: "Course not found" })
			return
		}
		const languageCode = req.params.languageCode
		const reviewedBy = extractActorAddress(req)
		const result = await pool.query(
			`UPDATE course_translations
			 SET status = 'published', published_at = CURRENT_TIMESTAMP, reviewed_by_address = $3, is_stale = FALSE
			 WHERE course_id = $1 AND language_code = $2 AND status = 'in_review'
			 RETURNING *`,
			[course.id, languageCode, reviewedBy],
		)
		if (result.rows.length === 0) {
			res
				.status(400)
				.json({ error: "No in_review translation is available to publish" })
			return
		}
		void invalidateApiResponseCacheType("courses")
		res.status(200).json(toCourseTranslation(result.rows[0]))
	} catch {
		res.status(500).json({ error: "Internal server error" })
	}
}

// ---------------------------------------------------------------------------
// Lesson translations
// ---------------------------------------------------------------------------

async function resolveActiveLesson(
	courseId: number,
	orderIndex: number,
): Promise<{
	title: string
	content_markdown: string
	version: number
} | null> {
	const result = (await pool.query(
		`SELECT title, content_markdown, version FROM lessons
		 WHERE course_id = $1 AND order_index = $2 AND is_active = TRUE
		 LIMIT 1`,
		[courseId, orderIndex],
	)) as {
		rows: Array<{ title: string; content_markdown: string; version: number }>
	}
	return result.rows[0] ?? null
}

export const getLessonTranslationEditorState = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const course = await resolveCourse(req.params.idOrSlug)
		if (!course) {
			res.status(404).json({ error: "Course not found" })
			return
		}
		const orderIndex = Number.parseInt(req.params.orderIndex, 10)
		const lesson = await resolveActiveLesson(course.id, orderIndex)
		if (!lesson) {
			res.status(404).json({ error: "Lesson not found" })
			return
		}
		const languageCode = req.params.languageCode
		const [translationResult, glossaryResult] = await Promise.all([
			pool.query(
				`SELECT * FROM lesson_translations
				 WHERE course_id = $1 AND order_index = $2 AND language_code = $3`,
				[course.id, orderIndex, languageCode],
			),
			pool.query(
				`SELECT id, term, note FROM course_glossary_terms WHERE course_id = $1 ORDER BY term ASC`,
				[course.id],
			),
		])
		res.status(200).json({
			source: {
				title: lesson.title,
				content: lesson.content_markdown,
				sourceVersion: lesson.version,
			},
			translation: translationResult.rows[0]
				? toLessonTranslation(translationResult.rows[0])
				: null,
			glossary: glossaryResult.rows,
		})
	} catch {
		res.status(500).json({ error: "Internal server error" })
	}
}

export const saveLessonTranslationDraft = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const course = await resolveCourse(req.params.idOrSlug)
		if (!course) {
			res.status(404).json({ error: "Course not found" })
			return
		}
		const orderIndex = Number.parseInt(req.params.orderIndex, 10)
		const lesson = await resolveActiveLesson(course.id, orderIndex)
		if (!lesson) {
			res.status(404).json({ error: "Lesson not found" })
			return
		}
		const languageCode = req.params.languageCode
		const body = req.body as { title?: unknown; content?: unknown }
		if (typeof body.title !== "string" || body.title.trim().length === 0) {
			res.status(400).json({ error: "title is required", field: "title" })
			return
		}
		// content_markdown is stored byte-for-byte, never run through
		// sanitizeHtml, matching how English lesson content is already handled
		// — code fences/links/headings must survive save/load untouched.
		if (typeof body.content !== "string") {
			res.status(400).json({ error: "content is required", field: "content" })
			return
		}
		const translatorAddress = req.translatorContext?.address ?? "admin"
		const result = await pool.query(
			`INSERT INTO lesson_translations
				(course_id, order_index, language_code, title, content_markdown, status, translator_address, source_version, is_stale)
			 VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, FALSE)
			 ON CONFLICT (course_id, order_index, language_code) DO UPDATE
			 SET title = EXCLUDED.title,
			     content_markdown = EXCLUDED.content_markdown,
			     translator_address = EXCLUDED.translator_address,
			     source_version = EXCLUDED.source_version,
			     is_stale = FALSE
			 RETURNING *`,
			[
				course.id,
				orderIndex,
				languageCode,
				body.title.trim(),
				body.content,
				translatorAddress,
				lesson.version,
			],
		)
		void invalidateApiResponseCacheType("courses")
		res.status(200).json(toLessonTranslation(result.rows[0]))
	} catch {
		res.status(500).json({ error: "Internal server error" })
	}
}

export const submitLessonTranslationForReview = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const course = await resolveCourse(req.params.idOrSlug)
		if (!course) {
			res.status(404).json({ error: "Course not found" })
			return
		}
		const orderIndex = Number.parseInt(req.params.orderIndex, 10)
		const languageCode = req.params.languageCode
		const result = await pool.query(
			`UPDATE lesson_translations
			 SET status = 'in_review'
			 WHERE course_id = $1 AND order_index = $2 AND language_code = $3
			   AND (status = 'draft' OR is_stale = TRUE)
			 RETURNING *`,
			[course.id, orderIndex, languageCode],
		)
		if (result.rows.length === 0) {
			res.status(400).json({
				error: "No draft or stale translation is available to submit",
			})
			return
		}
		void invalidateApiResponseCacheType("courses")
		res.status(200).json(toLessonTranslation(result.rows[0]))
	} catch {
		res.status(500).json({ error: "Internal server error" })
	}
}

export const publishLessonTranslation = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const course = await resolveCourse(req.params.idOrSlug)
		if (!course) {
			res.status(404).json({ error: "Course not found" })
			return
		}
		const orderIndex = Number.parseInt(req.params.orderIndex, 10)
		const languageCode = req.params.languageCode
		const reviewedBy = extractActorAddress(req)
		const result = await pool.query(
			`UPDATE lesson_translations
			 SET status = 'published', published_at = CURRENT_TIMESTAMP, reviewed_by_address = $4, is_stale = FALSE
			 WHERE course_id = $1 AND order_index = $2 AND language_code = $3 AND status = 'in_review'
			 RETURNING *`,
			[course.id, orderIndex, languageCode, reviewedBy],
		)
		if (result.rows.length === 0) {
			res
				.status(400)
				.json({ error: "No in_review translation is available to publish" })
			return
		}
		void invalidateApiResponseCacheType("courses")
		res.status(200).json(toLessonTranslation(result.rows[0]))
	} catch {
		res.status(500).json({ error: "Internal server error" })
	}
}

// ---------------------------------------------------------------------------
// Translator queue
// ---------------------------------------------------------------------------

export const getTranslatorQueue = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const language = req.translatorContext?.language
		if (!isSupportedLanguage(language)) {
			res.status(400).json({ error: "A valid ?language= is required" })
			return
		}

		const [untranslated, inReview, stale] = await Promise.all([
			pool.query(
				`SELECT c.slug AS course_slug, c.title AS course_title, l.order_index, l.title AS lesson_title
				 FROM lessons l
				 INNER JOIN courses c ON c.id = l.course_id
				 WHERE l.is_active = TRUE
				   AND c.published_at IS NOT NULL
				   AND NOT EXISTS (
				     SELECT 1 FROM lesson_translations lt
				     WHERE lt.course_id = l.course_id
				       AND lt.order_index = l.order_index
				       AND lt.language_code = $1
				   )
				 ORDER BY c.title ASC, l.order_index ASC`,
				[language],
			),
			pool.query(
				`SELECT 'course' AS kind, c.slug AS course_slug, NULL::int AS order_index, ct.title, ct.updated_at AS submitted_at
				 FROM course_translations ct
				 INNER JOIN courses c ON c.id = ct.course_id
				 WHERE ct.language_code = $1 AND ct.status = 'in_review'
				 UNION ALL
				 SELECT 'lesson' AS kind, c.slug AS course_slug, lt.order_index, lt.title, lt.updated_at AS submitted_at
				 FROM lesson_translations lt
				 INNER JOIN courses c ON c.id = lt.course_id
				 WHERE lt.language_code = $1 AND lt.status = 'in_review'
				 ORDER BY submitted_at ASC`,
				[language],
			),
			pool.query(
				`SELECT 'course' AS kind, c.slug AS course_slug, NULL::int AS order_index, ct.title, ct.source_version AS stale_since_version
				 FROM course_translations ct
				 INNER JOIN courses c ON c.id = ct.course_id
				 WHERE ct.language_code = $1 AND ct.is_stale = TRUE
				 UNION ALL
				 SELECT 'lesson' AS kind, c.slug AS course_slug, lt.order_index, lt.title, lt.source_version AS stale_since_version
				 FROM lesson_translations lt
				 INNER JOIN courses c ON c.id = lt.course_id
				 WHERE lt.language_code = $1 AND lt.is_stale = TRUE`,
				[language],
			),
		])

		res.status(200).json({
			untranslated: untranslated.rows.map((row) => ({
				courseSlug: row.course_slug,
				courseTitle: row.course_title,
				orderIndex: row.order_index,
				lessonTitle: row.lesson_title,
			})),
			inReview: inReview.rows.map((row) => ({
				kind: row.kind,
				courseSlug: row.course_slug,
				orderIndex: row.order_index,
				title: row.title,
				submittedAt: row.submitted_at,
			})),
			stale: stale.rows.map((row) => ({
				kind: row.kind,
				courseSlug: row.course_slug,
				orderIndex: row.order_index,
				title: row.title,
				staleSinceVersion: row.stale_since_version,
			})),
		})
	} catch {
		res.status(500).json({ error: "Internal server error" })
	}
}
