import { type Request, type Response } from "express"
import { pool } from "../db"

type WikiPageRow = {
	id: number
	slug: string
	title: string
	content: string
	category: string
	is_published: boolean
	created_at: string
	updated_at: string
}

const toWikiPage = (row: WikiPageRow) => ({
	id: row.id,
	slug: row.slug,
	title: row.title,
	content: row.content,
	category: row.category,
	isPublished: row.is_published,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
})

export const getWikiPages = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const includeUnpublished = req.query.includeUnpublished === "true"
		const category =
			typeof req.query.category === "string" ? req.query.category : undefined

		const conditions: string[] = []
		const params: unknown[] = []

		if (!includeUnpublished) {
			conditions.push("is_published = TRUE")
		}

		if (category) {
			params.push(category)
			conditions.push(`category = $${params.length}`)
		}

		const whereClause =
			conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
		const result = await pool.query(
			`SELECT * FROM wiki_pages ${whereClause} ORDER BY category, title ASC`,
			params,
		)

		res.status(200).json(result.rows.map(toWikiPage))
	} catch (error) {
		console.error("Error fetching wiki pages:", error)
		res.status(500).json({ error: "Internal server error" })
	}
}

export const getWikiPageBySlug = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const { slug } = req.params
		const result = await pool.query(
			"SELECT * FROM wiki_pages WHERE slug = $1 LIMIT 1",
			[slug],
		)

		if (result.rowCount === 0) {
			res.status(404).json({ error: "Wiki page not found" })
			return
		}

		res.status(200).json(toWikiPage(result.rows[0]))
	} catch (error) {
		console.error("Error fetching wiki page:", error)
		res.status(500).json({ error: "Internal server error" })
	}
}

export const createWikiPage = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const { title, slug, content, category, isPublished } = req.body

		if (!title || !slug || !content || !category) {
			res.status(400).json({ error: "Missing required fields" })
			return
		}

		const result = await pool.query(
			`INSERT INTO wiki_pages (title, slug, content, category, is_published)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING *`,
			[title, slug, content, category, isPublished !== false],
		)

		res.status(201).json(toWikiPage(result.rows[0]))
	} catch (error: any) {
		if (error.code === "23505") {
			res.status(409).json({ error: "Slug already exists" })
			return
		}
		console.error("Error creating wiki page:", error)
		res.status(500).json({ error: "Internal server error" })
	}
}

export const updateWikiPage = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const { id } = req.params
		const { title, slug, content, category, isPublished } = req.body

		const result = await pool.query(
			`UPDATE wiki_pages
			 SET title = COALESCE($1, title),
			     slug = COALESCE($2, slug),
			     content = COALESCE($3, content),
			     category = COALESCE($4, category),
			     is_published = COALESCE($5, is_published),
			     updated_at = CURRENT_TIMESTAMP
			 WHERE id = $6
			 RETURNING *`,
			[title, slug, content, category, isPublished, id],
		)

		if (result.rowCount === 0) {
			res.status(404).json({ error: "Wiki page not found" })
			return
		}

		res.status(200).json(toWikiPage(result.rows[0]))
	} catch (error: any) {
		if (error.code === "23505") {
			res.status(409).json({ error: "Slug already exists" })
			return
		}
		console.error("Error updating wiki page:", error)
		res.status(500).json({ error: "Internal server error" })
	}
}

export const deleteWikiPage = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const { id } = req.params
		const result = await pool.query("DELETE FROM wiki_pages WHERE id = $1", [
			id,
		])

		if (result.rowCount === 0) {
			res.status(404).json({ error: "Wiki page not found" })
			return
		}

		res.status(204).send()
	} catch (error) {
		console.error("Error deleting wiki page:", error)
		res.status(500).json({ error: "Internal server error" })
	}
}
