import { type Request, type Response } from "express"
import { pool } from "../db/index"

function parsePositiveInt(value: unknown, fallback: number): number {
	if (typeof value !== "string") return fallback
	const parsed = Number.parseInt(value, 10)
	if (Number.isNaN(parsed) || parsed < 0) return fallback
	return parsed
}

export const getEvents = async (req: Request, res: Response): Promise<void> => {
	const typeFilter =
		typeof req.query.type === "string" ? req.query.type.trim() : undefined
	const limit = Math.max(
		1,
		Math.min(parsePositiveInt(req.query.limit, 50), 100),
	)
	const offset = Math.max(0, parsePositiveInt(req.query.offset, 0))

	let query = `
		SELECT id, event_type, data, created_at
		FROM platform_events
	`
	const params: unknown[] = []

	if (typeFilter) {
		query += " WHERE event_type = $1"
		params.push(typeFilter)
	}

	const limitParam = params.length + 1
	const offsetParam = params.length + 2
	query += ` ORDER BY created_at DESC LIMIT $${limitParam} OFFSET $${offsetParam}`
	params.push(limit, offset)

	try {
		const result = await pool.query(query, params)
		res.status(200).json({ data: result.rows })
	} catch (err) {
		console.error("[events] Query failed:", err)
		res.status(500).json({ error: "Failed to fetch events" })
	}
}
