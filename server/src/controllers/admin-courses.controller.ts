import { type Request, type Response } from "express"
import { z } from "zod"
import { pool } from "../db/index"
import { AppError } from "../errors/app-error-handler"
import {
	courseBulkImportBodySchema,
	difficultyValues,
} from "../lib/zod-schemas"

interface CourseImportRow {
	title: string
	slug: string
	track: string
	difficulty: string
	description?: string
	coverImage?: string | null
	published?: boolean
}

interface CourseImportResult {
	row: number
	slug: string
	success: boolean
	errors: string[]
	course?: {
		id: number
		slug: string
		title: string
		description: string
		coverImage: string | null
		track: string
		difficulty: string
		published: boolean
		createdAt: string
		updatedAt: string
	}
}

const parseCsv = (csvText: string): Array<Record<string, string>> => {
	const lines = csvText
		.trim()
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)

	if (lines.length === 0) {
		return []
	}

	const headers = lines[0]
		.split(",")
		.map((header) => header.trim().replace(/\s+/g, ""))

	return lines.slice(1).map((line) => {
		const columns = line.split(",").map((col) => col.trim())
		const row: Record<string, string> = {}
		headers.forEach((name, index) => {
			row[name] = columns[index] ?? ""
		})
		return row
	})
}

const normalizeCsvRow = (row: Record<string, string>) => ({
	title: row.title ?? row.Title ?? "",
	slug: row.slug ?? row.Slug ?? "",
	track: row.track ?? row.Track ?? "",
	difficulty: row.difficulty ?? row.Difficulty ?? "",
	description: row.description ?? row.Description ?? "",
	coverImage: row.coverImage ?? row.CoverImage ?? null,
	published:
		row.published?.toLowerCase() === "true" ||
		row.published?.toLowerCase() === "yes" ||
		row.published?.toLowerCase() === "1"
})

const getClient = async () => {
	if (typeof (pool as any).connect === "function") {
		return await (pool as any).connect()
	}
	return pool as unknown as { query: typeof pool.query; release?: () => void }
}

const buildResult = (
	rowIndex: number,
	slug: string,
	success: boolean,
	errors: string[],
	course?: CourseImportResult["course"],
): CourseImportResult => ({
	row: rowIndex + 1,
	slug,
	success,
	errors,
	course,
})

export const bulkImportCourses = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const body = req.body as unknown
		const parseResult = courseBulkImportBodySchema.safeParse(body)
		if (!parseResult.success) {
			throw new AppError(
				"Validation failed",
				400,
				parseResult.error.issues.map((issue) => ({
					field: issue.path.join(".") || "body",
					message: issue.message,
				})),
			)
		}

		const requestData = parseResult.data
		let courses: CourseImportRow[] = []
		if ("csv" in requestData) {
			courses = parseCsv(requestData.csv).map(normalizeCsvRow)
		} else {
			courses = requestData.courses
		}

		const rowErrors: CourseImportResult[] = []
		const normalizedRows: CourseImportRow[] = []

		for (const [index, row] of courses.entries()) {
			if (!row || typeof row !== "object") {
				rowErrors.push(
					buildResult(index, String(row?.slug ?? `row-${index + 1}`), false, ["Invalid row format"]),
				)
				continue
			}

			const validation = z
				.object({
					title: z.string().trim().min(1, "title is required"),
					slug: z
						.string()
						.trim()
						.min(1, "slug is required")
						.regex(/^[a-zA-Z0-9-_]+$/, "slug may contain only letters, numbers, hyphens, and underscores"),
					track: z.string().trim().min(1, "track is required"),
					difficulty: z
						.string()
						.trim()
						.transform((value) => value.toLowerCase()),
					description: z.string().optional(),
					coverImage: z
						.string()
						.trim()
						.min(1)
						.optional()
						.nullable(),
					published: z.boolean().optional(),
				})
				.strict()
				.safeParse(row)

			const errors: string[] = []
			if (!validation.success) {
				for (const issue of validation.error.issues) {
					errors.push(issue.message)
				}
			} else {
				if (!difficultyValues.has(validation.data.difficulty)) {
					errors.push(
					`difficulty must be one of: ${Array.from(difficultyValues).join(", ")}`,
				)
			}
				if (errors.length === 0) {
					normalizedRows.push(validation.data)
				}
			}

			rowErrors.push(
				buildResult(
					index,
					String(row.slug ?? `row-${index + 1}`),
					errors.length === 0,
					errors,
				),
			)
		}

		const duplicateSlugMap = normalizedRows.reduce<Record<string, number[]>>(
			(acc, row, index) => {
				const slug = row.slug.toLowerCase()
				acc[slug] = acc[slug] ?? []
				acc[slug].push(index)
				return acc
			},
			{},
		)

		for (const [slug, indexes] of Object.entries(duplicateSlugMap)) {
			if (indexes.length > 1) {
				for (const index of indexes) {
					rowErrors[index].success = false
					rowErrors[index].errors.push("Duplicate slug found in upload payload")
				}
			}
		}

		const rowsToInsert = rowErrors
			.filter((row) => row.success)
			.map((row) => row.row - 1)

		if (rowsToInsert.length > 0) {
			const slugs = rowsToInsert.map((index) => normalizedRows[index].slug.toLowerCase())
			const existing = await pool.query(
				`SELECT slug FROM courses WHERE LOWER(slug) = ANY($1::text[])`,
				[slugs],
			)
			for (const row of rowErrors) {
				if (!row.success) continue
				if (
					existing.rows.some(
						(record: { slug: string }) =>
							record.slug.toLowerCase() === row.slug.toLowerCase(),
					)
				) {
					row.success = false
					row.errors.push("A course with this slug already exists")
				}
			}
		}

		const needsInsert = rowErrors.some((row) => row.success)
		const previewOnly = requestData.preview === true

		if (!previewOnly && needsInsert) {
			const client = await getClient()
			try {
				await client.query("BEGIN")
				const insertedCourses: CourseImportResult[] = []
				for (const rowIndex of rowErrors
					.filter((row) => row.success)
					.map((row) => row.row - 1)) {
					const row = normalizedRows[rowIndex]
					const result = await client.query(
						`INSERT INTO courses (title, slug, description, cover_image_url, track, difficulty, published_at)
						 VALUES ($1, $2, $3, $4, $5, $6, $7)
						 RETURNING id, slug, title, description, cover_image_url, track, difficulty, published_at, created_at, updated_at`,
						[
							row.title,
							row.slug,
							row.description ?? "",
							row.coverImage ?? null,
							row.track,
							row.difficulty,
							row.published ? new Date().toISOString() : null,
						],
					)
					const course = result.rows[0]
					insertedCourses.push(
						buildResult(rowIndex, row.slug, true, [], {
							id: course.id,
							slug: course.slug,
							title: course.title,
							description: course.description,
							coverImage: course.cover_image_url,
							track: course.track,
							difficulty: course.difficulty,
							published: Boolean(course.published_at),
							createdAt: course.created_at,
							updatedAt: course.updated_at,
						}),
					)
				}
				await client.query("COMMIT")
				for (const inserted of insertedCourses) {
					const existingIndex = rowErrors.findIndex(
						(row) => row.row === inserted.row && row.slug === inserted.slug,
					)
					if (existingIndex !== -1) {
						rowErrors[existingIndex] = inserted
					}
				}
			} catch (err) {
				await client.query("ROLLBACK")
				throw err
			} finally {
				client.release?.()
			}
		}

		res.status(200).json({
			results: rowErrors,
			total: rowErrors.length,
			imported: rowErrors.filter((row) => row.success).length,
		})
	} catch (error) {
		if (error instanceof AppError) {
			res.status(error.statusCode).json({ errors: error.details ?? [{ message: error.message }] })
			return
		}

		console.error("[admin-courses] bulk import error", error)
		res.status(500).json({ error: "Internal server error" })
	}
}
