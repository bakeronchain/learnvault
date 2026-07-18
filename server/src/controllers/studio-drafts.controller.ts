import { type Request, type Response } from "express"
import { pool } from "../db"
import { type AuthRequest } from "../middleware/auth.middleware"

const draftStatusValues = new Set([
	"draft",
	"in_review",
	"approved",
	"rejected",
	"published",
])

function getDraftLrnThreshold(): number {
	const raw = process.env.COURSE_DRAFT_LRN_THRESHOLD ?? "100"
	const parsed = Number.parseInt(raw, 10)
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 100
}

async function getAuthorLrnBalance(address: string): Promise<number> {
	const result = await pool.query(
		`SELECT COALESCE(lrn_balance, 0)::numeric AS bal
		 FROM scholar_balances
		 WHERE address = $1
		 LIMIT 1`,
		[address],
	)
	const value = result.rows[0]?.bal
	if (typeof value === "string") return Number.parseFloat(value)
	if (typeof value === "number") return value
	return 0
}

async function ensureQualifiedAuthor(address: string): Promise<boolean> {
	const balance = await getAuthorLrnBalance(address)
	return balance >= getDraftLrnThreshold()
}

function normalizeStatus(raw: unknown): string {
	if (typeof raw === "string" && draftStatusValues.has(raw)) {
		return raw
	}
	return "draft"
}

function toDraftRow(row: any) {
	if (!row) {
		return null
	}
	return {
		id: Number(row.id),
		authorAddr: row.author_addr,
		title: row.title,
		description: row.description ?? null,
		difficulty: row.difficulty ?? "beginner",
		status: row.status ?? "draft",
		content: row.content ?? {},
		reviewNotes: row.review_notes ?? null,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export async function getStudioDrafts(req: AuthRequest, res: Response) {
	const address = req.user?.address ?? req.walletAddress
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const result = await pool.query(
		`SELECT id, author_addr, title, description, difficulty, status, content, review_notes, created_at, updated_at
		 FROM course_drafts
		 WHERE author_addr = $1
		 ORDER BY updated_at DESC, id DESC`,
		[address],
	)

	res.json({ drafts: result.rows.map(toDraftRow) })
}

export async function getStudioDraftsForAdmin(req: Request, res: Response) {
	const result = await pool.query(
		`SELECT id, author_addr, title, description, difficulty, status, content, review_notes, created_at, updated_at
		 FROM course_drafts
		 ORDER BY updated_at DESC, id DESC`,
	)

	res.json({ drafts: result.rows.map(toDraftRow) })
}

export async function createStudioDraft(req: AuthRequest, res: Response) {
	const address = req.user?.address ?? req.walletAddress
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	if (!(await ensureQualifiedAuthor(address))) {
		res.status(403).json({
			error: `You must hold at least ${getDraftLrnThreshold()} LRN to create course drafts; threshold not met`,
		})
		return
	}

	const body = req.body as Record<string, unknown>
	const title = typeof body.title === "string" ? body.title.trim() : ""
	const description =
		typeof body.description === "string" ? body.description : null
	const difficulty =
		typeof body.difficulty === "string" ? body.difficulty.toLowerCase() : "beginner"
	const content = typeof body.content === "object" && body.content !== null ? body.content : {}

	if (!title) {
		res.status(400).json({ error: "title is required" })
		return
	}

	const result = await pool.query(
		`INSERT INTO course_drafts (author_addr, title, description, difficulty, status, content)
		 VALUES ($1, $2, $3, $4, 'draft', $5::jsonb)
		 RETURNING id, author_addr, title, description, difficulty, status, content, review_notes, created_at, updated_at`,
		[address, title, description, difficulty, JSON.stringify(content)],
	)
	const draftRow = toDraftRow(result.rows[0])
	if (!draftRow) {
		res.status(500).json({ error: "Failed to create draft" })
		return
	}
	res.status(201).json(draftRow)
}

export async function updateStudioDraft(req: AuthRequest, res: Response) {
	const address = req.user?.address ?? req.walletAddress
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const id = Number.parseInt(req.params.id ?? "", 10)
	if (!Number.isInteger(id) || id <= 0) {
		res.status(400).json({ error: "Invalid draft id" })
		return
	}

	const body = req.body as Record<string, unknown>
	const title =
		typeof body.title === "string" ? body.title.trim() : undefined
	const description =
		typeof body.description === "string" || body.description === null
		? body.description
		: undefined
	const difficulty =
		typeof body.difficulty === "string"
		? body.difficulty.toLowerCase()
		: undefined
	const content =
		typeof body.content === "object" && body.content !== null
		? body.content
		: undefined

	const existing = await pool.query(
		`SELECT id, author_addr, title, description, difficulty, status, content, review_notes, created_at, updated_at
		 FROM course_drafts
		 WHERE id = $1 AND author_addr = $2
		 LIMIT 1`,
		[id, address],
	)
	if (existing.rows.length === 0) {
		res.status(404).json({ error: "Draft not found" })
		return
	}

	const draft = existing.rows[0]
	const nextTitle = title ?? draft.title
	const nextDescription = description ?? draft.description
	const nextDifficulty = difficulty ?? draft.difficulty ?? "beginner"
	const nextContent = content ?? draft.content ?? {}
	const nextStatus = normalizeStatus(draft.status)

	const result = await pool.query(
		`UPDATE course_drafts
		 SET title = $1, description = $2, difficulty = $3, content = $4::jsonb, status = $5, updated_at = NOW()
		 WHERE id = $6 AND author_addr = $7
		 RETURNING id, author_addr, title, description, difficulty, status, content, review_notes, created_at, updated_at`,
		[nextTitle, nextDescription, nextDifficulty, JSON.stringify(nextContent), nextStatus, id, address],
	)
	const draftRow = toDraftRow((result?.rows?.[0] ?? {
		id,
		author_addr: address,
		title: nextTitle,
		description: nextDescription,
		difficulty: nextDifficulty,
		status: nextStatus,
		content: nextContent,
		review_notes: draft.review_notes,
		created_at: draft.created_at,
		updated_at: draft.updated_at,
	}) as any)
	if (!draftRow) {
		res.status(500).json({ error: "Failed to update draft" })
		return
	}
	res.json(draftRow)
}

export async function submitStudioDraft(req: AuthRequest, res: Response) {
	const address = req.user?.address ?? req.walletAddress
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const id = Number.parseInt(req.params.id ?? "", 10)
	if (!Number.isInteger(id) || id <= 0) {
		res.status(400).json({ error: "Invalid draft id" })
		return
	}

	const existing = await pool.query(
		`SELECT id, author_addr, title, description, difficulty, status, content, review_notes, created_at, updated_at
		 FROM course_drafts
		 WHERE id = $1 AND author_addr = $2
		 LIMIT 1`,
		[id, address],
	)
	if (existing.rows.length === 0) {
		res.status(404).json({ error: "Draft not found" })
		return
	}

	const result = await pool.query(
		`UPDATE course_drafts
		 SET status = 'in_review', updated_at = NOW(), review_notes = NULL
		 WHERE id = $1 AND author_addr = $2
		 RETURNING id, author_addr, title, description, difficulty, status, content, review_notes, created_at, updated_at`,
		[id, address],
	)
	const draftRow = toDraftRow((result?.rows?.[0] ?? {
		...existing.rows[0],
		status: "in_review",
		review_notes: null,
	}) as any)
	if (!draftRow) {
		res.status(500).json({ error: "Failed to submit draft" })
		return
	}
	res.json(draftRow)
}

export async function reviewStudioDraft(req: Request, res: Response) {
	const id = Number.parseInt(req.params.id ?? "", 10)
	if (!Number.isInteger(id) || id <= 0) {
		res.status(400).json({ error: "Invalid draft id" })
		return
	}
	const body = req.body as Record<string, unknown>
	const decision = typeof body.decision === "string" ? body.decision : "reject"
	const notes = typeof body.notes === "string" ? body.notes : null
	const existing = await pool.query(
		`SELECT id, author_addr, title, description, difficulty, status, content, review_notes, created_at, updated_at
		 FROM course_drafts
		 WHERE id = $1
		 LIMIT 1`,
		[id],
	)
	if (existing.rows.length === 0) {
		res.status(404).json({ error: "Draft not found" })
		return
	}
	const draft = existing.rows[0]
	const nextStatus = decision === "approve" ? "approved" : "rejected"
	const reviewResult = await pool.query(
		`UPDATE course_drafts
		 SET status = $1, review_notes = $2, updated_at = NOW()
		 WHERE id = $3
		 RETURNING id, author_addr, title, description, difficulty, status, content, review_notes, created_at, updated_at`,
		[nextStatus, notes, id],
	)
	if (decision === "approve") {
		await materializeDraftToCatalog(draft)
	}
	const reviewRow = toDraftRow((reviewResult?.rows?.[0] ?? {
		...draft,
		status: nextStatus,
		review_notes: notes,
	}) as any)
	if (!reviewRow) {
		res.status(500).json({ error: "Failed to review draft" })
		return
	}
	res.json(reviewRow)
}

async function materializeDraftToCatalog(draft: any) {
	const slug = String(draft.title).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `draft-${draft.id}`
	const courseInsert = await pool.query(
		`INSERT INTO courses (slug, title, description, cover_image_url, track, difficulty, published_at, prerequisites)
		 VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, '[]'::integer[])
		 RETURNING id, slug, title, description, cover_image_url, track, difficulty, published_at, created_at, updated_at, prerequisites`,
		[slug, draft.title, draft.description ?? "", null, "general", draft.difficulty ?? "beginner", []],
	)
	const course = courseInsert.rows[0]
	const content = draft.content ?? {}
	const lessons = Array.isArray((content as any).lessons) ? (content as any).lessons : []
	for (const [index, lesson] of lessons.entries()) {
		const lessonResult = await pool.query(
			`INSERT INTO lessons (course_id, order_index, title, content_markdown, estimated_minutes)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id`,
			[course.id, index + 1, lesson.title ?? `Lesson ${index + 1}`, lesson.content ?? "", lesson.estimatedMinutes ?? 10],
		)
		const lessonId = lessonResult.rows[0]?.id
		if (lessonId && lesson.milestone) {
			await pool.query(
				`INSERT INTO milestones (course_id, lesson_id, on_chain_milestone_id, lrn_amount)
				 VALUES ($1, $2, $3, $4)`,
				[course.id, lessonId, index + 1, 0],
			)
		}
	}
	return course
}
