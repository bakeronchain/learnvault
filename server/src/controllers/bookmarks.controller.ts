import { type Response } from "express"

import { pool } from "../db/index"
import { type AuthRequest } from "../middleware/auth.middleware"

/**
 * List the authenticated learner's bookmarks, newest first.
 * Address comes from the JWT — clients cannot spoof another user's list.
 */
export const listBookmarks = async (
	req: AuthRequest,
	res: Response,
): Promise<void> => {
	const address = req.walletAddress
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	try {
		const result = await pool.query(
			`SELECT id, course_id, created_at
			 FROM bookmarks
			 WHERE address = $1
			 ORDER BY created_at DESC`,
			[address],
		)

		res.status(200).json({
			data: result.rows.map((row) => ({
				bookmark_id: row.id,
				course_id: row.course_id,
				created_at: row.created_at,
			})),
		})
	} catch (error) {
		console.error("[bookmarks] Error listing bookmarks:", error)
		res.status(500).json({ error: "Failed to fetch bookmarks" })
	}
}

/**
 * Create a bookmark for the authenticated learner + given course_id.
 * Idempotent: re-POSTing the same pair returns 200 with the existing row
 * instead of 409, so the frontend can treat "toggle on" as fire-and-forget.
 *
 * Uses a single upsert with `ON CONFLICT DO UPDATE` so we always get the row
 * back atomically — no race window where a concurrent DELETE could leave us
 * with no row to return. We use `xmax = 0` (returns true only for INSERTs,
 * not UPDATEs) to distinguish "new" (201) from "already existed" (200).
 */
export const createBookmark = async (
	req: AuthRequest,
	res: Response,
): Promise<void> => {
	const address = req.walletAddress
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const { course_id } = req.body as { course_id: string }

	try {
		const result = await pool.query(
			`INSERT INTO bookmarks (address, course_id)
			 VALUES ($1, $2)
			 ON CONFLICT (address, course_id) DO UPDATE
			   SET address = EXCLUDED.address
			 RETURNING id, course_id, created_at, (xmax = 0) AS is_new`,
			[address, course_id],
		)

		const row = result.rows[0]
		if (!row) {
			console.error("[bookmarks] Upsert returned no rows — unexpected")
			res.status(500).json({ error: "Failed to create bookmark" })
			return
		}

		const status = row.is_new ? 201 : 200
		res.status(status).json({
			bookmark_id: row.id,
			course_id: row.course_id,
			created_at: row.created_at,
		})
	} catch (error) {
		console.error("[bookmarks] Error creating bookmark:", error)
		res.status(500).json({ error: "Failed to create bookmark" })
	}
}

/**
 * Delete a bookmark for the authenticated learner + given course_id.
 * Idempotent: returns 204 whether the row existed or not.
 */
export const deleteBookmark = async (
	req: AuthRequest,
	res: Response,
): Promise<void> => {
	const address = req.walletAddress
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const { courseId } = req.params as { courseId: string }

	try {
		await pool.query(
			`DELETE FROM bookmarks WHERE address = $1 AND course_id = $2`,
			[address, courseId],
		)
		res.status(204).send()
	} catch (error) {
		console.error("[bookmarks] Error deleting bookmark:", error)
		res.status(500).json({ error: "Failed to delete bookmark" })
	}
}
