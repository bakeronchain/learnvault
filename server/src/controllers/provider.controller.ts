import { type Request, type Response } from "express"
import { pool } from "../db"
import { AppError } from "../errors/app-error-handler"
import { logger } from "../lib/logger"

const log = logger.child({ module: "provider" })

// ---------------------------------------------------------------------------
// Courses — submit / list
// ---------------------------------------------------------------------------

export const submitCourse = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const { title, slug, description, difficulty, track, external_url } =
		req.body as {
			title: string
			slug: string
			description?: string
			difficulty: string
			track?: string
			external_url?: string
		}

	if (!title || !slug || !difficulty) {
		throw new AppError("title, slug, and difficulty are required", 400)
	}

	const allowed = ["beginner", "intermediate", "advanced"]
	if (!allowed.includes(difficulty)) {
		throw new AppError(
			"Invalid difficulty. Must be beginner, intermediate, or advanced",
			400,
		)
	}

	const slugCheck = await pool.query(`SELECT id FROM courses WHERE slug = $1`, [
		slug,
	])
	if (slugCheck.rows.length > 0) {
		throw new AppError("Slug already exists", 409)
	}

	const result = await pool.query(
		`INSERT INTO courses (title, slug, description, difficulty, track, external_url, provider_key_id, is_published)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, false)
		 RETURNING id, title, slug, description, difficulty, track, external_url, is_published, created_at`,
		[
			title,
			slug,
			description ?? null,
			difficulty,
			track ?? null,
			external_url ?? null,
			req.providerId,
		],
	)

	res.status(201).json({ data: result.rows[0] })
}

export const listProviderCourses = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100)
	const offset = parseInt(String(req.query.offset ?? "0"), 10)

	const result = await pool.query(
		`SELECT id, title, slug, description, difficulty, track, external_url,
		        is_published, created_at
		 FROM courses
		 WHERE provider_key_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2 OFFSET $3`,
		[req.providerId, limit, offset],
	)

	const countResult = await pool.query(
		`SELECT COUNT(*) AS total FROM courses WHERE provider_key_id = $1`,
		[req.providerId],
	)

	res.json({
		data: result.rows,
		pagination: {
			total: parseInt(String(countResult.rows[0]?.total ?? "0"), 10),
			limit,
			offset,
		},
	})
}

// ---------------------------------------------------------------------------
// Completions — report / list
// ---------------------------------------------------------------------------

export const reportCompletion = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const { learner_address, course_id, milestone_id, tx_hash, completed_at } =
		req.body as {
			learner_address: string
			course_id: number
			milestone_id?: number
			tx_hash?: string
			completed_at?: string
		}

	if (!learner_address || !course_id) {
		throw new AppError("learner_address and course_id are required", 400)
	}

	// Verify the course belongs to this provider
	const courseCheck = await pool.query(
		`SELECT id FROM courses WHERE id = $1 AND provider_key_id = $2`,
		[course_id, req.providerId],
	)
	if (courseCheck.rows.length === 0) {
		throw new AppError(
			"Course not found or not owned by this provider key",
			404,
		)
	}

	// Check for duplicate completion
	const dupCheck = await pool.query(
		`SELECT id FROM provider_completions
		 WHERE learner_address = $1 AND course_id = $2
		   AND ($3::integer IS NULL OR milestone_id = $3)`,
		[learner_address, course_id, milestone_id ?? null],
	)
	if (dupCheck.rows.length > 0) {
		throw new AppError("Completion already recorded", 409)
	}

	const result = await pool.query(
		`INSERT INTO provider_completions
			(learner_address, course_id, milestone_id, provider_key_id, tx_hash, completed_at)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, learner_address, course_id, milestone_id, tx_hash, completed_at, created_at`,
		[
			learner_address,
			course_id,
			milestone_id ?? null,
			req.providerId,
			tx_hash ?? null,
			completed_at ? new Date(completed_at) : new Date(),
		],
	)

	log.info(
		{ providerId: req.providerId, learner_address, course_id },
		"Completion recorded",
	)

	res.status(201).json({ data: result.rows[0] })
}

export const listCompletions = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 200)
	const offset = parseInt(String(req.query.offset ?? "0"), 10)
	const courseId = req.query.course_id
		? parseInt(String(req.query.course_id), 10)
		: null

	const result = await pool.query(
		`SELECT pc.id, pc.learner_address, pc.course_id, c.slug AS course_slug,
		        pc.milestone_id, pc.tx_hash, pc.completed_at, pc.created_at
		 FROM provider_completions pc
		 JOIN courses c ON c.id = pc.course_id
		 WHERE pc.provider_key_id = $1
		   AND ($2::integer IS NULL OR pc.course_id = $2)
		 ORDER BY pc.completed_at DESC
		 LIMIT $3 OFFSET $4`,
		[req.providerId, courseId, limit, offset],
	)

	const countResult = await pool.query(
		`SELECT COUNT(*) AS total FROM provider_completions
		 WHERE provider_key_id = $1 AND ($2::integer IS NULL OR course_id = $2)`,
		[req.providerId, courseId],
	)

	res.json({
		data: result.rows,
		pagination: {
			total: parseInt(String(countResult.rows[0]?.total ?? "0"), 10),
			limit,
			offset,
		},
	})
}

// ---------------------------------------------------------------------------
// LRN data — read learner token balance
// ---------------------------------------------------------------------------

export const getLrnBalance = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const { address } = req.params

	if (!address || typeof address !== "string") {
		throw new AppError("address is required", 400)
	}

	// Balance is stored via the event indexer in platform_events; we aggregate
	// mint and transfer events to derive the current off-chain tracked balance.
	const result = await pool.query(
		`SELECT
		    SUM(CASE WHEN event_type = 'LearnToken::Mint' AND data->>'to' = $1
		            THEN (data->>'amount')::numeric ELSE 0 END) -
		    SUM(CASE WHEN event_type = 'LearnToken::Transfer' AND data->>'from' = $1
		            THEN (data->>'amount')::numeric ELSE 0 END) +
		    SUM(CASE WHEN event_type = 'LearnToken::Transfer' AND data->>'to' = $1
		            THEN (data->>'amount')::numeric ELSE 0 END) AS balance
		 FROM platform_events
		 WHERE event_type IN ('LearnToken::Mint', 'LearnToken::Transfer')
		   AND (data->>'to' = $1 OR data->>'from' = $1)`,
		[address],
	)

	const raw = result.rows[0]?.balance
	const balance = raw !== null && raw !== undefined ? String(raw) : "0"

	res.json({ address, lrn_balance: balance })
}
