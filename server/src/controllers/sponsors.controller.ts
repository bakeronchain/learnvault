import { type Request, type Response } from "express"
import { pool } from "../db"
import { logger } from "../lib/logger"

const log = logger.child({ module: "sponsors" })

function asNonEmptyString(value: unknown): string | null {
	if (typeof value !== "string") return null
	const normalized = value.trim()
	return normalized.length > 0 ? normalized : null
}

function parseOptionalPositiveNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
		return value
	}
	if (typeof value === "string") {
		const parsed = Number.parseFloat(value)
		if (Number.isFinite(parsed) && parsed >= 0) return parsed
	}
	return null
}

export async function getOrganizationProfile(
	req: Request,
	res: Response,
): Promise<void> {
	const walletAddress = asNonEmptyString(req.params.walletAddress)
	if (!walletAddress) {
		res.status(400).json({ error: "walletAddress is required" })
		return
	}

	try {
		const result = await pool.query(
			`SELECT wallet_address, name, logo_url, website, mission, created_at, updated_at
			 FROM sponsor_organizations
			 WHERE LOWER(wallet_address) = LOWER($1)
			 LIMIT 1`,
			[walletAddress],
		)

		if (!result.rows[0]) {
			res.status(404).json({ error: "Organization profile not found" })
			return
		}

		res.status(200).json({ profile: result.rows[0] })
	} catch (err) {
		log.error({ err }, "Failed to fetch organization profile")
		res.status(500).json({ error: "Failed to fetch organization profile" })
	}
}

export async function upsertOrganizationProfile(
	req: Request,
	res: Response,
): Promise<void> {
	const walletAddress = asNonEmptyString(req.params.walletAddress)
	const name = asNonEmptyString(req.body?.name)
	const logoUrl = asNonEmptyString(req.body?.logo_url)
	const website = asNonEmptyString(req.body?.website)
	const mission = asNonEmptyString(req.body?.mission)

	if (!walletAddress) {
		res.status(400).json({ error: "walletAddress is required" })
		return
	}

	if (!name) {
		res.status(400).json({ error: "name is required" })
		return
	}

	try {
		const result = await pool.query(
			`INSERT INTO sponsor_organizations (wallet_address, name, logo_url, website, mission)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (wallet_address)
			 DO UPDATE SET
				name = EXCLUDED.name,
				logo_url = EXCLUDED.logo_url,
				website = EXCLUDED.website,
				mission = EXCLUDED.mission,
				updated_at = CURRENT_TIMESTAMP
			 RETURNING wallet_address, name, logo_url, website, mission, created_at, updated_at`,
			[walletAddress, name, logoUrl, website, mission],
		)

		res.status(200).json({ profile: result.rows[0] })
	} catch (err) {
		log.error({ err }, "Failed to save organization profile")
		res.status(500).json({ error: "Failed to save organization profile" })
	}
}

export async function createTrackSponsorship(
	req: Request,
	res: Response,
): Promise<void> {
	const walletAddress = asNonEmptyString(req.body?.wallet_address)
	const track = asNonEmptyString(req.body?.track)
	const donationUsdc = parseOptionalPositiveNumber(req.body?.donation_usdc)
	const txHash = asNonEmptyString(req.body?.tx_hash)

	if (!walletAddress || !track || donationUsdc === null) {
		res.status(400).json({
			error: "wallet_address, track, and donation_usdc are required",
		})
		return
	}

	try {
		const orgResult = await pool.query(
			`SELECT id
			 FROM sponsor_organizations
			 WHERE LOWER(wallet_address) = LOWER($1)
			 LIMIT 1`,
			[walletAddress],
		)

		if (!orgResult.rows[0]) {
			res.status(404).json({
				error: "Organization profile not found. Create profile first.",
			})
			return
		}

		const organizationId = Number(orgResult.rows[0].id)
		const insertResult = await pool.query(
			`INSERT INTO sponsor_track_donations (organization_id, track, donation_usdc, tx_hash)
			 VALUES ($1, $2, $3, $4)
			 RETURNING id, organization_id, track, donation_usdc, tx_hash, sponsored_at`,
			[organizationId, track, donationUsdc, txHash],
		)

		res.status(201).json({ sponsorship: insertResult.rows[0] })
	} catch (err) {
		log.error({ err }, "Failed to create track sponsorship")
		res.status(500).json({ error: "Failed to create track sponsorship" })
	}
}

export async function getTrackSponsorLogos(
	req: Request,
	res: Response,
): Promise<void> {
	const track = asNonEmptyString(req.query.track)
	if (!track) {
		res.status(400).json({ error: "track query parameter is required" })
		return
	}

	try {
		const result = await pool.query(
			`SELECT
				o.wallet_address,
				o.name,
				o.logo_url,
				o.website,
				SUM(d.donation_usdc)::text AS total_track_donated_usdc,
				MAX(d.sponsored_at) AS latest_sponsorship_at
			 FROM sponsor_track_donations d
			 INNER JOIN sponsor_organizations o ON o.id = d.organization_id
			 WHERE LOWER(d.track) = LOWER($1)
			 GROUP BY o.wallet_address, o.name, o.logo_url, o.website
			 ORDER BY SUM(d.donation_usdc) DESC, MAX(d.sponsored_at) DESC`,
			[track],
		)

		res.status(200).json({
			track,
			sponsors: result.rows,
		})
	} catch (err) {
		log.error({ err }, "Failed to fetch track sponsor logos")
		res.status(500).json({ error: "Failed to fetch track sponsor logos" })
	}
}

export async function getOrganizationDashboard(
	req: Request,
	res: Response,
): Promise<void> {
	const walletAddress = asNonEmptyString(req.params.walletAddress)
	if (!walletAddress) {
		res.status(400).json({ error: "walletAddress is required" })
		return
	}

	try {
		const tracksResult = await pool.query(
			`SELECT DISTINCT d.track
			 FROM sponsor_track_donations d
			 INNER JOIN sponsor_organizations o ON o.id = d.organization_id
			 WHERE LOWER(o.wallet_address) = LOWER($1)
			 ORDER BY d.track ASC`,
			[walletAddress],
		)

		const tracks = tracksResult.rows.map((row) => String(row.track))

		if (tracks.length === 0) {
			res.status(200).json({
				tracks: [],
				scholars: [],
			})
			return
		}

		const progressResult = await pool.query(
			`WITH sponsored_tracks AS (
				SELECT DISTINCT LOWER(d.track) AS track
				FROM sponsor_track_donations d
				INNER JOIN sponsor_organizations o ON o.id = d.organization_id
				WHERE LOWER(o.wallet_address) = LOWER($1)
			), enrolled_courses AS (
				SELECT DISTINCT e.learner_address, e.course_id
				FROM enrollments e
				INNER JOIN courses c ON c.slug = e.course_id
				INNER JOIN sponsored_tracks st ON LOWER(c.track) = st.track
			), course_totals AS (
				SELECT c.slug AS course_id, COUNT(m.id)::int AS total_milestones
				FROM courses c
				LEFT JOIN milestones m ON m.course_id = c.id
				GROUP BY c.slug
			), scholar_course_progress AS (
				SELECT
					ec.learner_address,
					ec.course_id,
					COALESCE(ct.total_milestones, 0) AS total_milestones,
					COUNT(mr.id) FILTER (WHERE mr.status = 'approved')::int AS completed_milestones
				FROM enrolled_courses ec
				LEFT JOIN course_totals ct ON ct.course_id = ec.course_id
				LEFT JOIN milestone_reports mr
					ON mr.scholar_address = ec.learner_address
					AND mr.course_id = ec.course_id
				GROUP BY ec.learner_address, ec.course_id, ct.total_milestones
			)
			SELECT
				scp.learner_address,
				SUM(scp.completed_milestones)::int AS completed_milestones,
				SUM(scp.total_milestones)::int AS total_milestones,
				CASE
					WHEN SUM(scp.total_milestones) > 0
						THEN ROUND(SUM(scp.completed_milestones)::numeric / SUM(scp.total_milestones)::numeric, 4)
					ELSE 0
				END AS completion_rate
			FROM scholar_course_progress scp
			GROUP BY scp.learner_address
			ORDER BY completion_rate DESC, completed_milestones DESC, scp.learner_address ASC`,
			[walletAddress],
		)

		res.status(200).json({
			tracks,
			scholars: progressResult.rows,
		})
	} catch (err) {
		log.error({ err }, "Failed to fetch organization dashboard")
		res.status(500).json({ error: "Failed to fetch organization dashboard" })
	}
}

export async function getOrganizationQuarterlyReport(
	req: Request,
	res: Response,
): Promise<void> {
	const walletAddress = asNonEmptyString(req.params.walletAddress)
	if (!walletAddress) {
		res.status(400).json({ error: "walletAddress is required" })
		return
	}

	const year = Number.parseInt(String(req.query.year ?? ""), 10)
	const quarter = Number.parseInt(String(req.query.quarter ?? ""), 10)
	const filterYear = Number.isInteger(year) && year >= 2000 ? year : null
	const filterQuarter =
		Number.isInteger(quarter) && quarter >= 1 && quarter <= 4 ? quarter : null

	try {
		const filters: string[] = []
		const params: Array<number | string> = [walletAddress]

		if (filterYear !== null) {
			params.push(filterYear)
			filters.push(`report.year = $${params.length}`)
		}

		if (filterQuarter !== null) {
			params.push(filterQuarter)
			filters.push(`report.quarter = $${params.length}`)
		}

		const whereClause =
			filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : ""

		const result = await pool.query(
			`WITH org_tracks_by_quarter AS (
				SELECT
					EXTRACT(YEAR FROM d.sponsored_at)::int AS year,
					EXTRACT(QUARTER FROM d.sponsored_at)::int AS quarter,
					LOWER(d.track) AS track,
					SUM(d.donation_usdc)::numeric AS donated_usdc
				FROM sponsor_track_donations d
				INNER JOIN sponsor_organizations o ON o.id = d.organization_id
				WHERE LOWER(o.wallet_address) = LOWER($1)
				GROUP BY 1, 2, 3
			), quarterly_donations AS (
				SELECT
					year,
					quarter,
					SUM(donated_usdc)::numeric AS total_donated_usdc,
					COUNT(DISTINCT track)::int AS sponsored_tracks_count
				FROM org_tracks_by_quarter
				GROUP BY year, quarter
			), quarterly_scholars AS (
				SELECT
					ot.year,
					ot.quarter,
					COUNT(DISTINCT e.learner_address)::int AS scholars_impacted
				FROM org_tracks_by_quarter ot
				INNER JOIN courses c ON LOWER(c.track) = ot.track
				INNER JOIN enrollments e ON e.course_id = c.slug
				GROUP BY ot.year, ot.quarter
			), quarterly_milestones AS (
				SELECT
					ot.year,
					ot.quarter,
					COUNT(mr.id) FILTER (WHERE mr.status = 'approved')::int AS milestones_completed
				FROM org_tracks_by_quarter ot
				INNER JOIN courses c ON LOWER(c.track) = ot.track
				LEFT JOIN milestone_reports mr ON mr.course_id = c.slug
				GROUP BY ot.year, ot.quarter
			), report AS (
				SELECT
					d.year,
					d.quarter,
					d.total_donated_usdc::text AS total_donated_usdc,
					d.sponsored_tracks_count,
					COALESCE(s.scholars_impacted, 0) AS scholars_impacted,
					COALESCE(m.milestones_completed, 0) AS milestones_completed
				FROM quarterly_donations d
				LEFT JOIN quarterly_scholars s
					ON s.year = d.year AND s.quarter = d.quarter
				LEFT JOIN quarterly_milestones m
					ON m.year = d.year AND m.quarter = d.quarter
			)
			SELECT *
			FROM report
			${whereClause}
			ORDER BY year DESC, quarter DESC`,
			params,
		)

		res.status(200).json({
			reports: result.rows,
		})
	} catch (err) {
		log.error({ err }, "Failed to generate quarterly sponsor report")
		res.status(500).json({ error: "Failed to generate quarterly sponsor report" })
	}
}

export async function upsertScholarRegion(
	req: Request,
	res: Response,
): Promise<void> {
	const learnerAddress = asNonEmptyString(req.body?.learner_address)
	const countryRegion = asNonEmptyString(req.body?.country_region)

	if (!learnerAddress || !countryRegion) {
		res.status(400).json({
			error: "learner_address and country_region are required",
		})
		return
	}

	try {
		const result = await pool.query(
			`INSERT INTO scholar_regions (learner_address, country_region)
			 VALUES ($1, $2)
			 ON CONFLICT (learner_address)
			 DO UPDATE SET
				country_region = EXCLUDED.country_region,
				updated_at = CURRENT_TIMESTAMP
			 RETURNING learner_address, country_region, updated_at`,
			[learnerAddress, countryRegion],
		)

		res.status(200).json({ profile: result.rows[0] })
	} catch (err) {
		log.error({ err }, "Failed to save scholar region")
		res.status(500).json({ error: "Failed to save scholar region" })
	}
}
