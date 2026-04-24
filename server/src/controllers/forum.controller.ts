import { type Request, type Response } from "express"
import { pool } from "../db"
import { createEmailService } from "../services/email.service"

export const listForumThreads = async (req: Request, res: Response): Promise<void> => {
	try {
		const idOrSlug = req.params.idOrSlug
		const isNumericId = /^\d+$/.test(idOrSlug)

		// First try to find the course
		const courseQuery = isNumericId
			? `SELECT id FROM courses WHERE id = $1 AND published_at IS NOT NULL`
			: `SELECT id, slug FROM courses WHERE slug = $1 AND published_at IS NOT NULL`

		const courseResult = await pool.query(courseQuery, [
			isNumericId ? Number.parseInt(idOrSlug, 10) : idOrSlug,
		])

		if (courseResult.rowCount === 0) {
			res.status(404).json({ error: "Course not found" })
			return
		}

		// List threads
		const course_id = isNumericId ? idOrSlug : courseResult.rows[0].slug

		const threadsResult = await pool.query(
			`SELECT t.id, t.course_id, t.author_address, t.title, t.content, t.created_at, t.updated_at,
			 (SELECT COUNT(*)::int FROM forum_replies r WHERE r.thread_id = t.id) as reply_count
			 FROM forum_threads t
			 WHERE t.course_id = $1
			 ORDER BY t.created_at DESC`,
			[course_id]
		)

		res.status(200).json({ data: threadsResult.rows })
	} catch (error) {
		console.error("[forum] listForumThreads error:", error)
		res.status(500).json({ error: "Internal server error" })
	}
}

export const createForumThread = async (req: Request, res: Response): Promise<void> => {
	try {
		const idOrSlug = req.params.idOrSlug
		const isNumericId = /^\d+$/.test(idOrSlug)
        const authorAddress = (req as any).walletAddress || (req as any).user?.address

        if (!authorAddress) {
            res.status(401).json({ error: "Unauthorized" })
            return
        }

		const courseResult = await pool.query(
			isNumericId
				? `SELECT id, slug FROM courses WHERE id = $1 AND published_at IS NOT NULL`
				: `SELECT id, slug FROM courses WHERE slug = $1 AND published_at IS NOT NULL`,
			[isNumericId ? Number.parseInt(idOrSlug, 10) : idOrSlug]
		)

		if (courseResult.rowCount === 0) {
			res.status(404).json({ error: "Course not found" })
			return
		}

		const course_id = courseResult.rows[0].slug
		const { title, content } = req.body

		if (!title || typeof title !== "string" || title.trim().length === 0) {
			res.status(400).json({ error: "title is required" })
			return
		}

		if (!content || typeof content !== "string" || content.trim().length === 0) {
			res.status(400).json({ error: "content is required" })
			return
		}

		const result = await pool.query(
			`INSERT INTO forum_threads (course_id, author_address, title, content)
			 VALUES ($1, $2, $3, $4)
			 RETURNING *`,
			[course_id, authorAddress, title.trim(), content.trim()]
		)

		res.status(201).json(result.rows[0])
	} catch (error) {
		console.error("[forum] createForumThread error:", error)
		res.status(500).json({ error: "Internal server error" })
	}
}

export const getForumThread = async (req: Request, res: Response): Promise<void> => {
	try {
		const threadId = Number.parseInt(req.params.threadId, 10)
		if (!Number.isInteger(threadId) || threadId <= 0) {
			res.status(400).json({ error: "Invalid thread ID" })
			return
		}

		const threadResult = await pool.query(
			`SELECT * FROM forum_threads WHERE id = $1`,
			[threadId]
		)

		if (threadResult.rowCount === 0) {
			res.status(404).json({ error: "Thread not found" })
			return
		}

		const repliesResult = await pool.query(
			`SELECT * FROM forum_replies WHERE thread_id = $1 ORDER BY created_at ASC`,
			[threadId]
		)

		res.status(200).json({
			...threadResult.rows[0],
			replies: repliesResult.rows,
		})
	} catch (error) {
		console.error("[forum] getForumThread error:", error)
		res.status(500).json({ error: "Internal server error" })
	}
}

export const replyToForumThread = async (req: Request, res: Response): Promise<void> => {
	try {
		const threadId = Number.parseInt(req.params.threadId, 10)
		if (!Number.isInteger(threadId) || threadId <= 0) {
			res.status(400).json({ error: "Invalid thread ID" })
			return
		}

        const authorAddress = (req as any).walletAddress || (req as any).user?.address
        if (!authorAddress) {
            res.status(401).json({ error: "Unauthorized" })
            return
        }

		const { content } = req.body

		if (!content || typeof content !== "string" || content.trim().length === 0) {
			res.status(400).json({ error: "content is required" })
			return
		}

		const threadResult = await pool.query(
			`SELECT * FROM forum_threads WHERE id = $1`,
			[threadId]
		)

		if (threadResult.rowCount === 0) {
			res.status(404).json({ error: "Thread not found" })
			return
		}

		const thread = threadResult.rows[0]

		const result = await pool.query(
			`INSERT INTO forum_replies (thread_id, author_address, content)
			 VALUES ($1, $2, $3)
			 RETURNING *`,
			[threadId, authorAddress, content.trim()]
		)

        // Email notification using mock mechanism if email isn't directly known or mapped
        // Real implementation would look up scholar_email by author_address but we don't have a reliable email mapping table currently
		try {
            // Wait, we can fetch email if it was stored, but since it's not uniformly stored, 
            // we will simulate the EmailService call to log it.
            const emailService = createEmailService(process.env.RESEND_API_KEY || "")
            console.log(`[Forum] Sending reply notification to thread owner: ${thread.author_address}`)
            
            // For now, let's use a dummy email based on wallet to simulate since we don't store actual emails universally
            const targetEmail = `${thread.author_address}@example.com` // Mock email
            
            await emailService.sendNotification({
                to: targetEmail,
                subject: "New Reply to your Thread",
                template: "forum-reply",
                data: {
                    name: thread.author_address.slice(0, 6) + "...", // Short wallet as name
                    threadTitle: thread.title,
                    replyPreview: content.trim().slice(0, 100) + (content.length > 100 ? "..." : ""),
                    threadUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/courses/${thread.course_id}?tab=forum&thread=${thread.id}`
                }
            })
		} catch (emailErr) {
			console.error("[forum] email notification failed:", emailErr)
		}

		res.status(201).json(result.rows[0])
	} catch (error) {
		console.error("[forum] replyToForumThread error:", error)
		res.status(500).json({ error: "Internal server error" })
	}
}

export const deleteForumThread = async (req: Request, res: Response): Promise<void> => {
	try {
		const threadId = Number.parseInt(req.params.threadId, 10)
		if (!Number.isInteger(threadId) || threadId <= 0) {
			res.status(400).json({ error: "Invalid thread ID" })
			return
		}

		await pool.query(`DELETE FROM forum_threads WHERE id = $1`, [threadId])
		res.status(200).json({ success: true })
	} catch (error) {
		console.error("[forum] deleteForumThread error:", error)
		res.status(500).json({ error: "Internal server error" })
	}
}

export const deleteForumReply = async (req: Request, res: Response): Promise<void> => {
	try {
		const replyId = Number.parseInt(req.params.replyId, 10)
		if (!Number.isInteger(replyId) || replyId <= 0) {
			res.status(400).json({ error: "Invalid reply ID" })
			return
		}

		await pool.query(`DELETE FROM forum_replies WHERE id = $1`, [replyId])
		res.status(200).json({ success: true })
	} catch (error) {
		console.error("[forum] deleteForumReply error:", error)
		res.status(500).json({ error: "Internal server error" })
	}
}
