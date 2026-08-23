#!/usr/bin/env ts-node
/**
 * Seeds one real, human-quality Swahili translation of a course + its lessons
 * — proof that the translation pipeline works end to end, not placeholder
 * copy. Reads the actual Swahili text from a fixture file (the reviewable
 * artifact in the PR diff) and upserts it as published course_translations /
 * lesson_translations rows.
 *
 * Idempotent — safe to re-run; re-running re-publishes the same fixture
 * content rather than erroring on already-existing rows.
 *
 * Usage:
 *   npm run seed:swahili-course [fixtureFile]
 *   (defaults to fixtures/swahili-intro-to-stellar.json)
 *
 * Requires DATABASE_URL in server/.env, migrations applied, and the course
 * referenced by fixture.courseSlug already seeded (see scripts/seed.ts).
 */

import fs from "node:fs"
import path from "node:path"
import dotenv from "dotenv"
import { Pool } from "pg"

dotenv.config({ path: path.resolve(__dirname, "../.env") })

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
	console.error("ERROR: DATABASE_URL is not set in server/.env")
	process.exit(1)
}

type Fixture = {
	courseSlug: string
	languageCode: string
	translatorAddress: string
	course: { title: string; description: string }
	glossary: Array<{ term: string; note?: string }>
	lessons: Array<{ orderIndex: number; title: string; content: string }>
}

const fixtureArg = process.argv[2] ?? "swahili-intro-to-stellar.json"
const fixturePath = path.isAbsolute(fixtureArg)
	? fixtureArg
	: path.resolve(__dirname, "fixtures", fixtureArg)

async function run(): Promise<void> {
	const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as Fixture
	const pool = new Pool({ connectionString: DATABASE_URL })
	const client = await pool.connect()

	try {
		await client.query("BEGIN")

		const courseResult = await client.query(
			`SELECT id, content_version FROM courses WHERE slug = $1 LIMIT 1`,
			[fixture.courseSlug],
		)
		const course = courseResult.rows[0] as
			{ id: number; content_version: number } | undefined
		if (!course) {
			throw new Error(
				`Course "${fixture.courseSlug}" not found — run "npm run db:seed" first.`,
			)
		}

		await client.query(
			`INSERT INTO course_translations
				(course_id, language_code, title, description, status, translator_address, source_version, is_stale, published_at)
			 VALUES ($1, $2, $3, $4, 'published', $5, $6, FALSE, CURRENT_TIMESTAMP)
			 ON CONFLICT (course_id, language_code) DO UPDATE
			 SET title = EXCLUDED.title,
			     description = EXCLUDED.description,
			     status = 'published',
			     translator_address = EXCLUDED.translator_address,
			     source_version = EXCLUDED.source_version,
			     is_stale = FALSE,
			     published_at = CURRENT_TIMESTAMP`,
			[
				course.id,
				fixture.languageCode,
				fixture.course.title,
				fixture.course.description,
				fixture.translatorAddress,
				course.content_version,
			],
		)
		console.log(
			`  course_translations: ${fixture.courseSlug} -> ${fixture.languageCode} (published)`,
		)

		for (const term of fixture.glossary) {
			await client.query(
				`INSERT INTO course_glossary_terms (course_id, term, note)
				 VALUES ($1, $2, $3)
				 ON CONFLICT (course_id, term) DO UPDATE SET note = EXCLUDED.note`,
				[course.id, term.term, term.note ?? null],
			)
		}
		console.log(`  glossary: ${fixture.glossary.length} term(s) upserted`)

		for (const lesson of fixture.lessons) {
			const lessonResult = await client.query(
				`SELECT version FROM lessons
				 WHERE course_id = $1 AND order_index = $2 AND is_active = TRUE
				 LIMIT 1`,
				[course.id, lesson.orderIndex],
			)
			const activeLesson = lessonResult.rows[0] as
				{ version: number } | undefined
			if (!activeLesson) {
				throw new Error(
					`Lesson order_index=${lesson.orderIndex} not found for course "${fixture.courseSlug}".`,
				)
			}

			await client.query(
				`INSERT INTO lesson_translations
					(course_id, order_index, language_code, title, content_markdown, status, translator_address, source_version, is_stale, published_at)
				 VALUES ($1, $2, $3, $4, $5, 'published', $6, $7, FALSE, CURRENT_TIMESTAMP)
				 ON CONFLICT (course_id, order_index, language_code) DO UPDATE
				 SET title = EXCLUDED.title,
				     content_markdown = EXCLUDED.content_markdown,
				     status = 'published',
				     translator_address = EXCLUDED.translator_address,
				     source_version = EXCLUDED.source_version,
				     is_stale = FALSE,
				     published_at = CURRENT_TIMESTAMP`,
				[
					course.id,
					lesson.orderIndex,
					fixture.languageCode,
					lesson.title,
					lesson.content,
					fixture.translatorAddress,
					activeLesson.version,
				],
			)
			console.log(
				`  lesson_translations: order_index=${lesson.orderIndex} -> ${fixture.languageCode} (published)`,
			)
		}

		await client.query("COMMIT")
		console.log(
			`\nDone. "${fixture.courseSlug}" is now fully translated into "${fixture.languageCode}".`,
		)
	} catch (err) {
		await client.query("ROLLBACK")
		throw err
	} finally {
		client.release()
		await pool.end()
	}
}

run().catch((err) => {
	console.error(err)
	process.exit(1)
})
