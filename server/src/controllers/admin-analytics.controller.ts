import { type Request, type Response } from "express"
import NodeCache from "node-cache"

import { pool } from "../db"
import { logger } from "../lib/logger"

const log = logger.child({ module: "admin-analytics" })

const analyticsCache = new NodeCache({ stdTTL: 60, checkperiod: 30 })
const CACHE_KEY = "admin_analytics_v1"

interface DailyActiveUsersRow {
	day: string | Date
	active_users: number | string
}

interface MilestonesPerDayRow {
	day: string | Date
	submitted: number | string
	approved: number | string
	rejected: number | string
}

interface TotalsRow {
	total_users?: number | string
	enrollments_this_week?: number | string
	enrollments_this_month?: number | string
	milestones_submitted?: number | string
	milestones_approved?: number | string
	milestones_rejected?: number | string
	total_lrn_minted?: number | string
	active_scholars?: number | string
}

function toDateOnly(value: string | Date): string {
	if (value instanceof Date) return value.toISOString().slice(0, 10)
	return String(value).slice(0, 10)
}

export async function getAdminAnalytics(
	_req: Request,
	res: Response,
): Promise<void> {
	const cached = analyticsCache.get(CACHE_KEY)
	if (cached) {
		res.status(200).json(cached)
		return
	}

	try {
		const [totalsResult, dauResult, milestonesPerDayResult] = await Promise.all(
			[
				pool.query<TotalsRow>(`
					WITH user_addresses AS (
						SELECT learner_address AS address FROM enrollments
						UNION
						SELECT scholar_address FROM milestone_reports
						UNION
						SELECT address FROM scholar_balances
					)
					SELECT
						(SELECT COUNT(*)::int FROM user_addresses) AS total_users,
						(SELECT COUNT(*)::int FROM enrollments
							WHERE enrolled_at >= CURRENT_DATE - INTERVAL '7 days') AS enrollments_this_week,
						(SELECT COUNT(*)::int FROM enrollments
							WHERE enrolled_at >= CURRENT_DATE - INTERVAL '30 days') AS enrollments_this_month,
						(SELECT COUNT(*)::int FROM milestone_reports) AS milestones_submitted,
						(SELECT COUNT(*)::int FROM milestone_reports WHERE status = 'approved') AS milestones_approved,
						(SELECT COUNT(*)::int FROM milestone_reports WHERE status = 'rejected') AS milestones_rejected,
						(SELECT COALESCE(SUM(lrn_balance), 0)::text FROM scholar_balances) AS total_lrn_minted,
						(SELECT COUNT(DISTINCT scholar_address)::int FROM milestone_reports
							WHERE submitted_at >= CURRENT_DATE - INTERVAL '30 days') AS active_scholars
				`),
				pool.query<DailyActiveUsersRow>(`
					WITH days AS (
						SELECT (CURRENT_DATE - i)::date AS day
						FROM generate_series(0, 29) i
					), activity AS (
						SELECT learner_address AS address, enrolled_at::date AS activity_date
						FROM enrollments
						WHERE enrolled_at >= CURRENT_DATE - INTERVAL '30 days'
						UNION
						SELECT scholar_address AS address, submitted_at::date AS activity_date
						FROM milestone_reports
						WHERE submitted_at >= CURRENT_DATE - INTERVAL '30 days'
						UNION
						SELECT validator_address AS address, decided_at::date AS activity_date
						FROM milestone_audit_log
						WHERE decided_at >= CURRENT_DATE - INTERVAL '30 days'
					), per_day AS (
						SELECT activity_date AS day, COUNT(DISTINCT address)::int AS active_users
						FROM activity
						GROUP BY activity_date
					)
					SELECT d.day, COALESCE(p.active_users, 0)::int AS active_users
					FROM days d
					LEFT JOIN per_day p ON p.day = d.day
					ORDER BY d.day ASC
				`),
				pool.query<MilestonesPerDayRow>(`
					WITH days AS (
						SELECT (CURRENT_DATE - i)::date AS day
						FROM generate_series(0, 29) i
					), submitted_per_day AS (
						SELECT submitted_at::date AS day, COUNT(*)::int AS submitted
						FROM milestone_reports
						WHERE submitted_at >= CURRENT_DATE - INTERVAL '30 days'
						GROUP BY submitted_at::date
					), decided_per_day AS (
						SELECT
							decided_at::date AS day,
							COUNT(*) FILTER (WHERE decision = 'approved')::int AS approved,
							COUNT(*) FILTER (WHERE decision = 'rejected')::int AS rejected
						FROM milestone_audit_log
						WHERE decided_at >= CURRENT_DATE - INTERVAL '30 days'
						GROUP BY decided_at::date
					)
					SELECT
						d.day,
						COALESCE(s.submitted, 0)::int AS submitted,
						COALESCE(dec.approved, 0)::int AS approved,
						COALESCE(dec.rejected, 0)::int AS rejected
					FROM days d
					LEFT JOIN submitted_per_day s ON s.day = d.day
					LEFT JOIN decided_per_day dec ON dec.day = d.day
					ORDER BY d.day ASC
				`),
			],
		)

		const totals = totalsResult.rows[0] ?? {}

		const payload = {
			totals: {
				total_users: Number(totals.total_users ?? 0),
				enrollments_this_week: Number(totals.enrollments_this_week ?? 0),
				enrollments_this_month: Number(totals.enrollments_this_month ?? 0),
				milestones_submitted: Number(totals.milestones_submitted ?? 0),
				milestones_approved: Number(totals.milestones_approved ?? 0),
				milestones_rejected: Number(totals.milestones_rejected ?? 0),
				total_lrn_minted: String(totals.total_lrn_minted ?? "0"),
				active_scholars: Number(totals.active_scholars ?? 0),
			},
			time_series: {
				daily_active_users: dauResult.rows.map((row) => ({
					day: toDateOnly(row.day),
					active_users: Number(row.active_users ?? 0),
				})),
				milestones_per_day: milestonesPerDayResult.rows.map((row) => ({
					day: toDateOnly(row.day),
					submitted: Number(row.submitted ?? 0),
					approved: Number(row.approved ?? 0),
					rejected: Number(row.rejected ?? 0),
				})),
			},
			generated_at: new Date().toISOString(),
			cache_ttl_seconds: 60,
		}

		analyticsCache.set(CACHE_KEY, payload)
		res.status(200).json(payload)
	} catch (err) {
		log.error({ err }, "getAdminAnalytics error")
		res.status(500).json({ error: "Failed to fetch admin analytics" })
	}
}
