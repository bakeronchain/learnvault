import { Router, type Response } from "express"
import sanitizeHtml from "sanitize-html"
import { pool } from "../db/index"
import { createCommentBodySchema } from "../lib/zod-schemas"
import {
	createRequireAuth,
	type AuthRequest,
} from "../middleware/auth.middleware"
import { validate } from "../middleware/validate.middleware"
import { type JwtService } from "../services/jwt.service"

export function createCommentsRouter(jwtService: JwtService): Router {
	const router = Router()
	const requireAuth = createRequireAuth(jwtService)
	const maxCommentLength = 2000
	const maxCommentsPerDay = Number.parseInt(
		process.env.MAX_COMMENTS_PER_DAY ?? "50",
		10,
	)

	/**
	 * @openapi
	 * /api/proposals/{proposalId}/comments:
	 *   get:
	 *     summary: Fetch comments for a proposal
	 *     tags: [Comments]
	 *     parameters:
	 *       - in: path
	 *         name: proposalId
	 *         required: true
	 *         schema: { type: string }
	 *     responses:
	 *       200:
	 *         description: List of comments
	 */
	router.get("/proposals/:proposalId/comments", async (req, res) => {
		const { proposalId } = req.params
		const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)
		const offset = Math.max(parseInt(req.query.offset as string) || 0, 0)
		try {
			const result = await pool.query(
				`SELECT * FROM comments WHERE proposal_id = $1 AND deleted_at IS NULL ORDER BY is_pinned DESC, created_at ASC LIMIT $2 OFFSET $3`,
				[proposalId, limit, offset],
			)
			res.json(result.rows)
		} catch (err) {
			res.status(500).json({ error: "Failed to fetch comments" })
		}
	})

	/**
	 * @openapi
	 * /api/comments:
	 *   post:
	 *     summary: Post a new comment
	 *     tags: [Comments]
	 *     security: [{ bearerAuth: [] }]
	 */
	router.post(
		"/comments",
		requireAuth,
		validate({
			body: createCommentBodySchema,
		}),
		async (req: AuthRequest, res: Response) => {
			const body = req.body as {
				proposalId?: string
				proposal_id?: string
				content?: string
				body?: string
				parentId?: number
				parent_id?: number
				author_address?: string
			}
			const proposalId = body.proposalId ?? body.proposal_id ?? ""
			const content = body.content ?? body.body ?? ""
			const parentId = body.parentId ?? body.parent_id
			const tokenAddress = req.user?.address ?? ""
			const authorAddress = body.author_address ?? tokenAddress
			const safeContent = sanitizeHtml(content, {
				allowedTags: [],
				allowedAttributes: {},
			})

			if (body.author_address && body.author_address !== tokenAddress) {
				return res.status(400).json({
					error: "Validation failed",
					message: "Validation failed",
					details: [
						{
							field: "author_address",
							message: "author_address must match the authenticated user",
						},
					],
				})
			}

			if (content.length > maxCommentLength) {
				return res.status(400).json({
					error: "Comment must be 2,000 characters or fewer",
				})
			}

			if (
				parentId !== undefined &&
				(parentId === null || !Number.isInteger(parentId) || parentId <= 0)
			) {
				return res.status(400).json({
					error: "parentId must be a positive integer or null",
				})
			}

			try {
				const globalSpamCheck = await pool.query(
					`SELECT COUNT(*) FROM comments
       WHERE author_address = $1
       AND created_at > NOW() - INTERVAL '1 day'`,
					[authorAddress],
				)

				if (parseInt(globalSpamCheck.rows[0].count) >= maxCommentsPerDay) {
					return res
						.status(429)
						.json({ error: "Global daily comment limit reached" })
				}

				// Spam protection: max 5 comments per address per proposal per day
				const spamCheck = await pool.query(
					`SELECT COUNT(*) FROM comments 
       WHERE author_address = $1 AND proposal_id = $2 
       AND created_at > NOW() - INTERVAL '1 day'`,
					[authorAddress, proposalId],
				)

				if (parseInt(spamCheck.rows[0].count) >= 5) {
					return res
						.status(429)
						.json({ error: "Daily comment limit reached for this proposal" })
				}

				const result = await pool.query(
					`INSERT INTO comments (proposal_id, author_address, content, parent_id) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
					[proposalId, authorAddress, safeContent, parentId ?? null],
				)

				res.status(201).json(result.rows[0])
			} catch (err) {
				res.status(500).json({ error: "Failed to post comment" })
			}
		},
	)

	/**
	 * @openapi
	 * /api/comments/{id}:
	 *   delete:
	 *     summary: Delete own comment (soft delete)
	 *     tags: [Comments]
	 *     security: [{ bearerAuth: [] }]
	 */
	router.delete(
		"/comments/:id",
		requireAuth,
		async (req: AuthRequest, res: Response) => {
			const { id } = req.params
			const authorAddress = req.user?.address

			try {
				// Check if comment exists and belongs to user (and not already deleted)
				const checkResult = await pool.query(
					`SELECT * FROM comments WHERE id = $1 AND author_address = $2 AND deleted_at IS NULL`,
					[id, authorAddress],
				)

				if (checkResult.rows.length === 0) {
					return res
						.status(404)
						.json({ error: "Comment not found or unauthorized" })
				}

				// Soft delete: set deleted_at timestamp
				await pool.query(
					`UPDATE comments SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`,
					[id],
				)

				res.json({ success: true })
			} catch (err) {
				res.status(500).json({ error: "Failed to delete comment" })
			}
		},
	)

	/**
	 * @openapi
	 * /api/comments/{id}/vote:
	 *   put:
	 *     summary: Upvote or downvote a comment
	 *     tags: [Comments]
	 *     security: [{ bearerAuth: [] }]
	 */
	router.put(
		"/comments/:id/vote",
		requireAuth,
		async (req: AuthRequest, res: Response) => {
			const { id } = req.params
			const { type } = req.body // 'upvote' or 'downvote'
			const voterAddress = req.user?.address

			if (!["upvote", "downvote"].includes(type)) {
				return res.status(400).json({ error: "Invalid vote type" })
			}

			const client = await pool.connect()
			try {
				await client.query("BEGIN")

				// Check if vote already exists
				const existingVote = await client.query(
					`SELECT vote_type FROM comment_votes WHERE comment_id = $1 AND voter_address = $2`,
					[id, voterAddress],
				)

				if (existingVote.rows.length > 0) {
					if (existingVote.rows[0].vote_type === type) {
						// Remove vote if clicking the same button
						await client.query(
							`DELETE FROM comment_votes WHERE comment_id = $1 AND voter_address = $2`,
							[id, voterAddress],
						)
						await client.query(
							`UPDATE comments SET ${type}s = ${type}s - 1 WHERE id = $1`,
							[id],
						)
					} else {
						// Change vote type
						const oldType = existingVote.rows[0].vote_type
						await client.query(
							`UPDATE comment_votes SET vote_type = $1 WHERE comment_id = $2 AND voter_address = $3`,
							[type, id, voterAddress],
						)
						await client.query(
							`UPDATE comments SET ${type}s = ${type}s + 1, ${oldType}s = ${oldType}s - 1 WHERE id = $1`,
							[id],
						)
					}
				} else {
					// New vote
					await client.query(
						`INSERT INTO comment_votes (comment_id, voter_address, vote_type) VALUES ($1, $2, $3)`,
						[id, voterAddress, type],
					)
					await client.query(
						`UPDATE comments SET ${type}s = ${type}s + 1 WHERE id = $1`,
						[id],
					)
				}

				await client.query("COMMIT")
				const updatedComment = await client.query(
					`SELECT * FROM comments WHERE id = $1`,
					[id],
				)
				res.json(updatedComment.rows[0])
			} catch (err) {
				await client.query("ROLLBACK")
				res.status(500).json({ error: "Failed to vote" })
			} finally {
				client.release()
			}
		},
	)

	/**
	 * @openapi
	 * /api/comments/{id}/pin:
	 *   put:
	 *     summary: Pin a comment (proposal author only)
	 *     tags: [Comments]
	 *     security: [{ bearerAuth: [] }]
	 */
	router.put(
		"/comments/:id/pin",
		requireAuth,
		async (req: AuthRequest, res: Response) => {
			const { id } = req.params
			const authorAddress = req.user?.address

			try {
				// Check if the user is the author of the proposal associated with this comment
				// For now, we'll assume a "proposal_authors" mapping or check a proposals table
				// In a real app, you'd fetch the proposal by comment.proposal_id and check its author

				// MOCK: Allow anyone to pin for now if they are the "author" of the proposal (which we'll just check against a param or something)
				// Actually, the user says "Proposal author can pin one comment".
				// I'll need a way to verify this.

				const commentRes = await pool.query(
					`SELECT proposal_id FROM comments WHERE id = $1 AND deleted_at IS NULL`,
					[id],
				)
				if (commentRes.rows.length === 0)
					return res.status(404).json({ error: "Comment not found" })

				const proposalId = commentRes.rows[0].proposal_id

				// Verify the requesting user is the proposal author
				const proposalRes = await pool.query(
					`SELECT author_address FROM proposals WHERE id = $1`,
					[proposalId],
				)
				if (proposalRes.rows.length === 0)
					return res.status(404).json({ error: "Proposal not found" })

				const proposalAuthor = proposalRes.rows[0].author_address
				if (proposalAuthor.toLowerCase() !== authorAddress?.toLowerCase())
					return res
						.status(403)
						.json({ error: "Only the proposal author can pin comments" })

				// UPDATE: Reset pins for this proposal and pin this one
				await pool.query(
					`UPDATE comments SET is_pinned = FALSE WHERE proposal_id = $1`,
					[proposalId],
				)
				await pool.query(`UPDATE comments SET is_pinned = TRUE WHERE id = $1`, [
					id,
				])

				res.json({ message: "Comment pinned" })
			} catch (err) {
				res.status(500).json({ error: "Failed to pin comment" })
			}
		},
	)

	return router
}
