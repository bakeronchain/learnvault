import { type Request, type Response } from "express"
import { pool } from "../db"

const MAX_QUERY_LENGTH = 200
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

const SEARCHABLE_TYPES = ["course", "lesson", "wiki", "forum", "profile"] as const
type SearchableType = (typeof SEARCHABLE_TYPES)[number]

interface SearchResultRow {
	type: SearchableType
	id: string
	title: string
	snippet: string
	url: string
	rank: number
}

// Headline options render <mark> markers the frontend splits on — never raw HTML injection.
const HEADLINE_OPTS = "StartSel=<mark>,StopSel=</mark>,MaxFragments=2,FragmentDelimiter= … "

function parseCursor(raw: string | undefined): { rank: number; type: string; id: string } | null {
	if (!raw) return null
	try {
		const decoded = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
			rank: number
			type: string
			id: string
		}
		if (
			typeof decoded.rank !== "number" ||
			typeof decoded.type !== "string" ||
			typeof decoded.id !== "string"
		) {
			return null
		}
		return decoded
	} catch {
		return null
	}
}

function encodeCursor(row: SearchResultRow): string {
	return Buffer.from(
		JSON.stringify({ rank: row.rank, type: row.type, id: row.id }),
		"utf8"
	).toString("base64url")
}

export const search = async (req: Request, res: Response): Promise<void> => {
	try {
		const q = typeof req.query.q === "string" ? req.query.q.trim() : ""
		if (!q) {
			res.status(400).json({ error: "Query parameter q is required" })
			return
		}
		if (q.length > MAX_QUERY_LENGTH) {
			res.status(400).json({ error: `Query too long (max ${MAX_QUERY_LENGTH} characters)` })
			return
		}

		const typeFilter = typeof req.query.type === "string" ? req.query.type : undefined
		if (typeFilter && !(SEARCHABLE_TYPES as readonly string[]).includes(typeFilter)) {
			res.status(400).json({ error: `type must be one of: ${SEARCHABLE_TYPES.join(", ")}` })
			return
		}

		const limitParam = Number.parseInt(String(req.query.limit ?? ""), 10)
		const limit = Number.isFinite(limitParam)
			? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
			: DEFAULT_LIMIT

		const cursor = parseCursor(typeof req.query.cursor === "string" ? req.query.cursor : undefined)

		// websearch_to_tsquery parses quotes / & / | / ! per Postgres' websearch
		// syntax and is bound as a parameter — nothing reaches SQL as raw text.
		// The tsquery is computed once in a CTE and reused by every branch.
		//
		// Visibility rules enforced inside each branch:
		//  - courses: published_at IS NOT NULL (lessons inherit via join)
		//  - wiki_pages: is_published = TRUE
		//  - profiles: display_name present (public scholar identity only)
		//  - forum: platform has no forum moderation state yet (flagged_content
		//    covers comments/proposals only), so threads are indexed as-is.
		const branches: Array<{ type: SearchableType; sql: string }> = ([
			{
				type: "course",
				sql: `SELECT 'course' AS type, c.id::text AS id, c.title,
						ts_headline('english', c.description, q.query, '${HEADLINE_OPTS}') AS snippet,
						'/courses/' || c.slug AS url,
						ts_rank_cd(c.search_vector, q.query) AS rank
					FROM courses c, q
					WHERE c.search_vector @@ q.query AND c.published_at IS NOT NULL`,
			},
			{
				type: "lesson",
				sql: `SELECT 'lesson' AS type, l.id::text AS id,
						c.title || ' → ' || l.title AS title,
						ts_headline('english', l.content_markdown, q.query, '${HEADLINE_OPTS}') AS snippet,
						'/courses/' || c.slug || '/lessons/' || l.id AS url,
						ts_rank_cd(l.search_vector, q.query) AS rank
					FROM lessons l
					JOIN courses c ON c.id = l.course_id AND c.published_at IS NOT NULL, q
					WHERE l.search_vector @@ q.query`,
			},
			{
				type: "wiki",
				sql: `SELECT 'wiki' AS type, w.id::text AS id, w.title,
						ts_headline('english', w.content, q.query, '${HEADLINE_OPTS}') AS snippet,
						'/wiki/' || w.slug AS url,
						ts_rank_cd(w.search_vector, q.query) AS rank
					FROM wiki_pages w, q
					WHERE w.search_vector @@ q.query AND w.is_published = TRUE`,
			},
			{
				type: "forum",
				sql: `SELECT 'forum' AS type, t.id::text AS id, t.title,
						ts_headline('english', t.content, q.query, '${HEADLINE_OPTS}') AS snippet,
						'/courses/' || t.course_id || '/forum/' || t.id AS url,
						ts_rank_cd(t.search_vector, q.query) AS rank
					FROM forum_threads t, q
					WHERE t.search_vector @@ q.query`,
			},
			{
				type: "profile",
				sql: `SELECT 'profile' AS type, p.address AS id,
						p.display_name AS title,
						ts_headline('english', coalesce(p.bio, ''), q.query, '${HEADLINE_OPTS}') AS snippet,
						'/scholars/' || p.address AS url,
						ts_rank_cd(p.search_vector, q.query) AS rank
					FROM user_profiles p, q
					WHERE p.search_vector @@ q.query AND p.display_name IS NOT NULL`,
			},
		] as Array<{ type: SearchableType; sql: string }>).filter(
			(b) => !typeFilter || b.type === typeFilter
		)

		if (branches.length === 0) {
			res.status(200).json({ data: [], nextCursor: null })
			return
		}

		const params: unknown[] = [q]
		let cursorClause = ""
		if (cursor) {
			// sort_rank is the negated rank so ascending lexicographic
			// comparison equals "relevance descending" ordering.
			params.push(-cursor.rank, cursor.type, cursor.id)
			cursorClause = `WHERE (sort_rank, type, id) < ($2::real, $3::text, $4::text)`
		}

		const sql = `
			WITH q AS (SELECT websearch_to_tsquery('english', $1) AS query)
			SELECT type, id, title, snippet, url, rank
			FROM (
				SELECT DISTINCT ON (type, id)
					type, id, title, snippet, url, rank, -rank AS sort_rank
				FROM (
					${branches.map((b) => b.sql).join("\nUNION ALL\n")}
				) combined
				ORDER BY type, id
			) deduped
			${cursorClause}
			ORDER BY sort_rank ASC, type ASC, id ASC
			LIMIT ${limit}`

		const result = await pool.query(sql, params)

		const rows: SearchResultRow[] = result.rows.map((r: any) => ({
			type: r.type,
			id: String(r.id),
			title: r.title,
			snippet: r.snippet,
			url: r.url,
			rank: Number(r.rank),
		}))

		const last = rows[rows.length - 1]
		const nextCursor =
			rows.length === limit && last ? encodeCursor(last) : null

		res.status(200).json({
			data: rows.map(({ rank: _rank, ...rest }) => rest),
			nextCursor,
		})
	} catch (error) {
		console.error("[search] error:", error)
		res.status(500).json({ error: "Internal server error" })
	}
}
