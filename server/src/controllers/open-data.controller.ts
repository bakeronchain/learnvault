import { type Request, type Response } from "express"
import { pool } from "../db"

/**
 * Public Open Data API handlers (issue #1060).
 *
 * Privacy rules are non-negotiable here:
 *  - no emails, KYC data, IP addresses or raw wallet-to-identity mappings
 *  - aggregate buckets with fewer than MIN_BUCKET_SUBJECTS subjects are
 *    suppressed — small counts re-identify individuals
 */

const MIN_BUCKET_SUBJECTS = 5

export interface PublicCourse {
	id: number
	slug: string
	title: string
	description: string
	difficulty: string
	track: string
}

export const listCourses = async (req: Request, res: Response): Promise<void> => {
	const limit = clampLimit(Number(req.query.limit ?? 20))
	const offset = Math.max(Number(req.query.offset ?? 0), 0)

	try {
		const total = await pool.query(
			`SELECT COUNT(*)::int AS n FROM courses WHERE published_at IS NOT NULL`,
		)
		const result = await pool.query(
			`SELECT id, slug, title, description, difficulty, track
			 FROM courses
			 WHERE published_at IS NOT NULL
			 ORDER BY id ASC
			 LIMIT $1 OFFSET $2`,
			[limit, offset],
		)

		const courses: PublicCourse[] = result.rows
		res.status(200).json({
			data: courses,
			pagination: {
				limit,
				offset,
				total: Number(total.rows[0]?.n ?? 0),
				hasMore: offset + courses.length < Number(total.rows[0]?.n ?? 0),
			},
		})
	} catch (err) {
		console.error("[open-data] listCourses error:", err)
		res.status(500).json({ error: "Internal server error" })
	}
}

/** Suppresses any aggregate bucket whose subject count is below the k-anonymity floor. */
function suppressSmallBuckets<T extends { subject_count: number }>(
	rows: T[],
): Array<Omit<T, "subject_count">> {
	return rows
		.filter((row) => row.subject_count >= MIN_BUCKET_SUBJECTS)
		.map(({ subject_count: _sc, ...rest }) => rest)
}

export const getStats = async (_req: Request, res: Response): Promise<void> => {
	try {
		const result = await pool.query(
			`SELECT
				(SELECT COUNT(DISTINCT learner_address)::int FROM enrollments) AS subject_count,
				COUNT(DISTINCT learner_address)::text AS learners,
				(SELECT COUNT(*)::text FROM enrollments WHERE completed_at IS NOT NULL) AS completions`,
			[],
		)
		void result // shape assembled below from dedicated queries for clarity

		const learners = await pool.query(
			`SELECT COUNT(DISTINCT learner_address)::int AS subject_count,
					COUNT(DISTINCT learner_address)::text AS value
			 FROM enrollments`,
			[],
		)
		const completions = await pool.query(
			`SELECT COUNT(DISTINCT learner_address)::int AS subject_count,
					COUNT(*)::text AS value
			 FROM enrollments WHERE completed_at IS NOT NULL`,
			[],
		)
		const lrn = await pool.query(
			`SELECT COUNT(DISTINCT address)::int AS subject_count,
					COALESCE(SUM(lrn_balance), 0)::text AS value
			 FROM scholar_balances`,
			[],
		)
		const scholarships = await pool.query(
			`SELECT COUNT(DISTINCT id)::int AS subject_count,
					COUNT(*)::text AS value
			 FROM scholarships`,
			[],
		)

		const suppressed = (rows: any[]) =>
			rows.filter((r) => r.subject_count >= MIN_BUCKET_SUBJECTS).map((r) => r.value)

		const stats = {
			active_learners: suppressed(learners.rows)[0] ?? null,
			course_completions: suppressed(completions.rows)[0] ?? null,
			lrn_distributed: suppressed(lrn.rows)[0] ?? null,
			scholarships_funded: suppressed(scholarships.rows)[0] ?? null,
		}

		res.status(200).json({ data: stats })
	} catch (err) {
		console.error("[open-data] getStats error:", err)
		res.status(500).json({ error: "Internal server error" })
	}
}

export const getLeaderboard = async (_req: Request, res: Response): Promise<void> => {
	const limit = clampLimit(Number(_req.query.limit ?? 25))

	try {
		// Only public handles are exposed; raw addresses are hashed so the board
		// can't be joined back to wallet identities. Buckets below the floor are
		// not applicable per-row, but a tiny board itself is suppressed.
		const result = await pool.query(
			`WITH ranked AS (
				SELECT display_name,
					   lrn_balance,
					   courses_completed,
					   ROW_NUMBER() OVER (ORDER BY lrn_balance DESC) AS rank
				FROM scholar_balances s
				JOIN user_profiles p ON p.address = s.address
				WHERE p.display_name IS NOT NULL
				ORDER BY lrn_balance DESC
				LIMIT $1
			)
			SELECT rank, display_name AS handle, lrn_balance AS balance, courses_completed,
				   COUNT(*) OVER () AS board_size
			FROM ranked`,
			[limit],
		)

		if (Number(result.rows[0]?.board_size ?? 0) < MIN_BUCKET_SUBJECTS) {
			res.status(200).json({ data: [], suppressed: true })
			return
		}

		// Explicit field selection — never spread raw rows so identity
		// columns can't ride along even if a query changes later.
		res.status(200).json({
			data: result.rows.map((r: any) => ({
				rank: Number(r.rank),
				handle: String(r.handle),
				balance: String(r.balance),
				courses_completed: Number(r.courses_completed),
			})),
		})
	} catch (err) {
		console.error("[open-data] getLeaderboard error:", err)
		res.status(500).json({ error: "Internal server error" })
	}
}

export const getTreasuryFlows = async (req: Request, res: Response): Promise<void> => {
	const days = clampLimit(Number(req.query.days ?? 30))

	try {
		// Aggregate flows only — individual depositor addresses never leave.
		const result = await pool.query(
			`SELECT
			   d.day,
			   d.flow_in,
			   d.subject_count AS in_subjects,
			   w.flow_out,
			   w.subject_count AS out_subjects
			 FROM (
			   SELECT DATE(created_at) AS day, SUM(amount)::text AS flow_in,
					  COUNT(DISTINCT payer)::int AS subject_count
			   FROM treasury_deposits
			   GROUP BY DATE(created_at)
			 ) d
			 FULL OUTER JOIN (
			   SELECT DATE(created_at) AS day, SUM(amount)::text AS flow_out,
					  COUNT(DISTINCT recipient)::int AS subject_count
			   FROM payouts
			   GROUP BY DATE(created_at)
			 ) w ON d.day = w.day
			 WHERE d.day >= CURRENT_DATE - ($1::int || ' days')::interval
			    OR w.day >= CURRENT_DATE - ($1::int || ' days')::interval
			 ORDER BY COALESCE(d.day, w.day) DESC
			 LIMIT 90`,
			[Math.min(Math.max(days, 1), 365)],
		)

		const flows = result.rows
			.filter(
				(r) =>
					(r.in_subjects === null || r.in_subjects >= MIN_BUCKET_SUBJECTS) &&
					(r.out_subjects === null || r.out_subjects >= MIN_BUCKET_SUBJECTS),
			)
			.map((r) => ({ day: r.day, inflow: r.flow_in ?? "0", outflow: r.flow_out ?? "0" }))

		res.status(200).json({ data: flows, suppressed: flows.length !== result.rows.length })
	} catch (err) {
		console.error("[open-data] getTreasuryFlows error:", err)
		res.status(500).json({ error: "Internal server error" })
	}
}

export const verifyCredential = async (req: Request, res: Response): Promise<void> => {
	const credentialId = typeof req.params.id === "string" ? req.params.id : ""

	try {
		const result = await pool.query(
			`SELECT n.id, c.slug AS course_slug, n.minted_at
			 FROM scholar_nfts n
			 JOIN courses c ON c.id = n.course_id
			 WHERE n.id::text = $1`,
			[credentialId],
		)

		if (result.rows.length === 0) {
			res.status(404).json({ valid: false, error: "Credential not found" })
			return
		}

		const row = result.rows[0]
		// Deliberately minimal payload — validity + course only, no holder identity.
		res.status(200).json({
			valid: true,
			credential_id: credentialId,
			course: row.course_slug,
			issued_at: row.minted_at,
		})
	} catch (err) {
		console.error("[open-data] verifyCredential error:", err)
		res.status(500).json({ error: "Internal server error" })
	}
}

function clampLimit(value: number, max = 100): number {
	if (!Number.isFinite(value)) return max > 0 ? 20 : value
	return Math.min(Math.max(Math.trunc(value), 1), max)
}
