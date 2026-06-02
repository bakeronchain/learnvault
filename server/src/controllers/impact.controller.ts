import { type Request, type Response } from "express"
import NodeCache from "node-cache"
import { pool } from "../db"
import { logger } from "../lib/logger"

const log = logger.child({ module: "impact" })
const impactCache = new NodeCache({ stdTTL: 300 })

export async function getPublicImpactMetrics(
	_req: Request,
	res: Response,
): Promise<void> {
	const cacheKey = "public_impact_metrics_v1"
	const cached = impactCache.get(cacheKey)
	if (cached) {
		res.status(200).json(cached)
		return
	}

	try {
		const [totalsResult, regionsResult, topCoursesResult, trendResult] =
			await Promise.all([
				pool.query(`
					WITH totals AS (
						SELECT
							(SELECT COUNT(DISTINCT learner_address)::int FROM enrollments) AS total_scholars_funded,
							(SELECT COALESCE(SUM(amount), 0)::numeric FROM scholarship_contributions) AS total_usdc_disbursed,
							(SELECT COALESCE(SUM(lrn_balance), 0)::numeric FROM scholar_balances) AS total_lrn_minted
					), course_totals AS (
						SELECT c.slug AS course_id, COUNT(m.id)::numeric AS total_milestones
						FROM courses c
						LEFT JOIN milestones m ON m.course_id = c.id
						GROUP BY c.slug
					), learner_completion AS (
						SELECT
							e.learner_address,
							COALESCE(SUM(ct.total_milestones), 0) AS total_milestones,
							COALESCE(SUM(ap.completed_milestones), 0) AS completed_milestones
						FROM enrollments e
						LEFT JOIN course_totals ct ON ct.course_id = e.course_id
						LEFT JOIN (
							SELECT
								scholar_address,
								course_id,
								COUNT(*) FILTER (WHERE status = 'approved')::numeric AS completed_milestones
							FROM milestone_reports
							GROUP BY scholar_address, course_id
						) ap
							ON ap.scholar_address = e.learner_address
							AND ap.course_id = e.course_id
						GROUP BY e.learner_address
					)
					SELECT
						t.total_scholars_funded,
						t.total_usdc_disbursed::text AS total_usdc_disbursed,
						t.total_lrn_minted::text AS total_lrn_minted,
						COALESCE(
							AVG(
								CASE
									WHEN lc.total_milestones > 0
										THEN lc.completed_milestones / lc.total_milestones
									ELSE 0
								END
							),
							0
						) AS average_course_completion_rate
					FROM totals t
					LEFT JOIN learner_completion lc ON TRUE;
				`),
				pool.query(`
					SELECT country_region, COUNT(*)::int AS scholar_count
					FROM scholar_regions
					GROUP BY country_region
					ORDER BY scholar_count DESC, country_region ASC
				`),
				pool.query(`
					SELECT
						COALESCE(c.slug, mr.course_id) AS course_id,
						COALESCE(c.title, mr.course_id) AS course_title,
						COUNT(*) FILTER (WHERE mr.status = 'approved')::int AS completed_count
					FROM milestone_reports mr
					LEFT JOIN courses c ON c.slug = mr.course_id
					GROUP BY COALESCE(c.slug, mr.course_id), COALESCE(c.title, mr.course_id)
					ORDER BY completed_count DESC, course_id ASC
					LIMIT 5
				`),
				pool.query(`
					WITH quarter_axis AS (
						SELECT date_trunc('quarter', gs)::date AS period_start
						FROM generate_series(
							date_trunc('quarter', CURRENT_DATE) - INTERVAL '7 quarter',
							date_trunc('quarter', CURRENT_DATE),
							INTERVAL '1 quarter'
						) gs
					), enrollment_stats AS (
						SELECT
							date_trunc('quarter', enrolled_at)::date AS period_start,
							COUNT(DISTINCT learner_address)::int AS scholars_funded
						FROM enrollments
						GROUP BY 1
					), disbursement_stats AS (
						SELECT
							date_trunc('quarter', created_at)::date AS period_start,
							COALESCE(SUM(amount), 0)::numeric AS usdc_disbursed
						FROM scholarship_contributions
						GROUP BY 1
					)
					SELECT
						CONCAT(
							EXTRACT(YEAR FROM qa.period_start)::int,
							'-Q',
							EXTRACT(QUARTER FROM qa.period_start)::int
						) AS quarter,
						COALESCE(es.scholars_funded, 0) AS scholars_funded,
						COALESCE(ds.usdc_disbursed, 0)::text AS usdc_disbursed
					FROM quarter_axis qa
					LEFT JOIN enrollment_stats es ON es.period_start = qa.period_start
					LEFT JOIN disbursement_stats ds ON ds.period_start = qa.period_start
					ORDER BY qa.period_start ASC
				`),
			])

		const totalsRow = totalsResult.rows[0] ?? {
			total_scholars_funded: 0,
			total_usdc_disbursed: "0",
			total_lrn_minted: "0",
			average_course_completion_rate: 0,
		}

		const payload = {
			totals: {
				total_scholars_funded: Number(totalsRow.total_scholars_funded ?? 0),
				total_usdc_disbursed: String(totalsRow.total_usdc_disbursed ?? "0"),
				total_lrn_minted: String(totalsRow.total_lrn_minted ?? "0"),
				average_course_completion_rate: Number(
					totalsRow.average_course_completion_rate ?? 0,
				),
			},
			countries_regions: regionsResult.rows,
			top_completed_courses: topCoursesResult.rows,
			trends: {
				quarterly: trendResult.rows,
			},
			generated_at: new Date().toISOString(),
		}

		impactCache.set(cacheKey, payload)
		res.status(200).json(payload)
	} catch (err) {
		log.error({ err }, "Failed to fetch public impact metrics")
		res.status(500).json({ error: "Failed to fetch impact metrics" })
	}
}

export async function getImpactWidgetData(
	_req: Request,
	res: Response,
): Promise<void> {
	const cacheKey = "public_impact_widget_v1"
	const cached = impactCache.get(cacheKey)
	if (cached) {
		res.status(200).json(cached)
		return
	}

	try {
		const result = await pool.query(`
			SELECT
				(SELECT COUNT(DISTINCT learner_address)::int FROM enrollments) AS total_scholars_funded,
				(SELECT COALESCE(SUM(amount), 0)::text FROM scholarship_contributions) AS total_usdc_disbursed,
				(SELECT COALESCE(SUM(lrn_balance), 0)::text FROM scholar_balances) AS total_lrn_minted
		`)

		const row = result.rows[0] ?? {
			total_scholars_funded: 0,
			total_usdc_disbursed: "0",
			total_lrn_minted: "0",
		}

		const payload = {
			total_scholars_funded: Number(row.total_scholars_funded ?? 0),
			total_usdc_disbursed: String(row.total_usdc_disbursed ?? "0"),
			total_lrn_minted: String(row.total_lrn_minted ?? "0"),
			generated_at: new Date().toISOString(),
		}

		impactCache.set(cacheKey, payload)
		res.status(200).json(payload)
	} catch (err) {
		log.error({ err }, "Failed to fetch impact widget data")
		res.status(500).json({ error: "Failed to fetch impact widget data" })
	}
}
