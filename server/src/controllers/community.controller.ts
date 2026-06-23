import { type Request, type Response } from "express"
import { pool } from "../db"
import { logger } from "../lib/logger"

const log = logger.child({ module: "community" })

const VALID_EVENT_TYPES = new Set(["hackathon", "study_group", "workshop"])

export type CommunityEvent = {
	id: string
	title: string
	description: string
	date: string
	type: "hackathon" | "study_group" | "workshop"
	link: string
	created_at: string
}

function asNonEmptyString(value: unknown): string | null {
	if (typeof value !== "string") return null
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : null
}

export const getEvents = async (req: Request, res: Response): Promise<void> => {
	try {
		const result = await pool.query(
			`SELECT id::text, title, description, date, type, link, created_at
			 FROM community_events
			 ORDER BY date ASC`,
		)
		res.json(result.rows)
	} catch (err) {
		log.error({ err }, "Failed to fetch community events")
		res.status(500).json({ error: "Failed to fetch community events" })
	}
}

export const createEvent = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const title = asNonEmptyString(req.body?.title)
	const description = asNonEmptyString(req.body?.description)
	const date = asNonEmptyString(req.body?.date)
	const type = asNonEmptyString(req.body?.type)
	const link = asNonEmptyString(req.body?.link)

	if (!title || !description || !date || !type || !link) {
		res.status(400).json({ error: "Missing required fields" })
		return
	}

	if (!VALID_EVENT_TYPES.has(type)) {
		res
			.status(400)
			.json({ error: "type must be one of: hackathon, study_group, workshop" })
		return
	}

	try {
		const result = await pool.query(
			`INSERT INTO community_events (title, description, date, type, link)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id::text, title, description, date, type, link, created_at`,
			[title, description, date, type, link],
		)
		res.status(201).json(result.rows[0])
	} catch (err) {
		log.error({ err }, "Failed to create community event")
		res.status(500).json({ error: "Failed to create community event" })
	}
}
