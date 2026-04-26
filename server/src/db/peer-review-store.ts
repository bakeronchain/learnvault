import { pool } from "./index"
import { inMemoryMilestoneStore, type MilestoneReport } from "./milestone-store"

export type PeerVerdict = "approve" | "reject"

export type PeerReviewRow = {
	id: number
	report_id: number
	reviewer_address: string
	verdict: PeerVerdict
	comment: string | null
	lrn_awarded: string
	created_at: string
}

function isRealPool(): boolean {
	return typeof (pool as any).totalCount !== "undefined"
}

function minLrnThreshold(): string {
	return process.env.PEER_REVIEW_MIN_LRN ?? "5000"
}

function peerReviewReward(): string {
	return process.env.PEER_REVIEW_LRN_REWARD ?? "25"
}

/** Clears in-memory peer reviews (used by integration tests). */
export function resetPeerReviewMemoryForTests(): void {
	inMemoryPeerReviews.length = 0
	inMemoryPeerSeq = 1
}

let inMemoryPeerSeq = 1
const inMemoryPeerReviews: PeerReviewRow[] = []

async function getReviewerDbLrnBalance(address: string): Promise<string> {
	if (!isRealPool()) {
		return "50000"
	}
	const r = await pool.query(
		`SELECT COALESCE(lrn_balance, 0)::text AS bal FROM scholar_balances WHERE address = $1`,
		[address],
	)
	return r.rows[0]?.bal ?? "0"
}

async function meetsReputationThreshold(address: string): Promise<boolean> {
	const bal = await getReviewerDbLrnBalance(address)
	try {
		return BigInt(bal.split(".")[0] ?? "0") >= BigInt(minLrnThreshold())
	} catch {
		return false
	}
}

export async function getPeerCountsByReportId(
	reportIds: number[],
): Promise<Map<number, { approve: number; reject: number }>> {
	const map = new Map<number, { approve: number; reject: number }>()
	for (const id of reportIds) {
		map.set(id, { approve: 0, reject: 0 })
	}
	if (reportIds.length === 0) return map

	if (!isRealPool()) {
		for (const pr of inMemoryPeerReviews) {
			const cur = map.get(pr.report_id)
			if (!cur) continue
			if (pr.verdict === "approve") cur.approve += 1
			else cur.reject += 1
		}
		return map
	}

	const result = await pool.query<{
		report_id: number
		approve: number
		reject: number
	}>(
		`SELECT report_id,
        COUNT(*) FILTER (WHERE verdict = 'approve')::int AS approve,
        COUNT(*) FILTER (WHERE verdict = 'reject')::int AS reject
      FROM milestone_peer_reviews
      WHERE report_id = ANY($1::int[])
      GROUP BY report_id`,
		[reportIds],
	)
	for (const row of result.rows) {
		map.set(Number(row.report_id), {
			approve: row.approve,
			reject: row.reject,
		})
	}
	return map
}

export async function attachPeerSummariesToReports(
	reports: MilestoneReport[],
): Promise<MilestoneReport[]> {
	const ids = reports.map((r) => r.id)
	const counts = await getPeerCountsByReportId(ids)
	return reports.map((r) => ({
		...r,
		peer_approval_count: counts.get(r.id)?.approve ?? 0,
		peer_rejection_count: counts.get(r.id)?.reject ?? 0,
	}))
}

export async function listRecentPeerReviewsForReport(
	reportId: number,
	limit = 20,
): Promise<PeerReviewRow[]> {
	if (!isRealPool()) {
		return inMemoryPeerReviews
			.filter((p) => p.report_id === reportId)
			.sort((a, b) => b.created_at.localeCompare(a.created_at))
			.slice(0, limit)
	}
	const result = await pool.query(
		`SELECT id, report_id, reviewer_address, verdict, comment,
        lrn_awarded::text AS lrn_awarded, created_at
      FROM milestone_peer_reviews
      WHERE report_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
		[reportId, limit],
	)
	return result.rows.map((row: any) => ({
		...row,
		lrn_awarded: String(row.lrn_awarded ?? "0"),
		created_at:
			row.created_at instanceof Date
				? row.created_at.toISOString()
				: String(row.created_at),
	})) as PeerReviewRow[]
}

export async function getPeerReviewQueue(
	reviewerAddress: string,
): Promise<MilestoneReport[]> {
	if (!(await meetsReputationThreshold(reviewerAddress))) {
		return []
	}

	if (!isRealPool()) {
		const pending = await inMemoryMilestoneStore.getPendingReports()
		const ids = pending.map((r) => r.id)
		const counts = await getPeerCountsByReportId(ids)
		return pending
			.filter((r) => r.scholar_address !== reviewerAddress)
			.filter(
				(r) =>
					!inMemoryPeerReviews.some(
						(pr) =>
							pr.report_id === r.id &&
							pr.reviewer_address === reviewerAddress,
					),
			)
			.map((r) => ({
				...r,
				peer_approval_count: counts.get(r.id)?.approve ?? 0,
				peer_rejection_count: counts.get(r.id)?.reject ?? 0,
			}))
			.sort((a, b) => a.submitted_at.localeCompare(b.submitted_at))
	}

	const minLrn = minLrnThreshold()
	const result = await pool.query<MilestoneReport & { peer_approval_count: number; peer_rejection_count: number }>(
		`SELECT mr.*,
        COALESCE(stats.approve, 0)::int AS peer_approval_count,
        COALESCE(stats.reject, 0)::int AS peer_rejection_count
      FROM milestone_reports mr
      LEFT JOIN (
        SELECT report_id,
          COUNT(*) FILTER (WHERE verdict = 'approve')::int AS approve,
          COUNT(*) FILTER (WHERE verdict = 'reject')::int AS reject
        FROM milestone_peer_reviews
        GROUP BY report_id
      ) stats ON stats.report_id = mr.id
      WHERE mr.status = 'pending'
        AND mr.scholar_address <> $1
        AND COALESCE(
          (SELECT lrn_balance FROM scholar_balances WHERE address = $1),
          0
        ) >= $2::numeric
        AND NOT EXISTS (
          SELECT 1 FROM enrollments e
          WHERE e.learner_address = $1 AND e.course_id = mr.course_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM milestone_peer_reviews pr
          WHERE pr.report_id = mr.id AND pr.reviewer_address = $1
        )
      ORDER BY mr.submitted_at ASC`,
		[reviewerAddress, minLrn],
	)
	return result.rows
}

export type SubmitPeerReviewResult =
	| { ok: true; lrn_awarded: string }
	| {
			ok: false
			code:
				| "NOT_FOUND"
				| "NOT_PENDING"
				| "SELF_REVIEW"
				| "SAME_COURSE"
				| "ALREADY_REVIEWED"
				| "INSUFFICIENT_REPUTATION"
	  }

export async function submitPeerReview(params: {
	reviewerAddress: string
	reportId: number
	verdict: PeerVerdict
	comment: string | null
}): Promise<SubmitPeerReviewResult> {
	const { reviewerAddress, reportId, verdict, comment } = params
	const reward = peerReviewReward()

	if (!isRealPool()) {
		if (!(await meetsReputationThreshold(reviewerAddress))) {
			return { ok: false, code: "INSUFFICIENT_REPUTATION" }
		}
		const report = await inMemoryMilestoneStore.getReportById(reportId)
		if (!report) return { ok: false, code: "NOT_FOUND" }
		if (report.status !== "pending") return { ok: false, code: "NOT_PENDING" }
		if (report.scholar_address === reviewerAddress) {
			return { ok: false, code: "SELF_REVIEW" }
		}
		if (
			inMemoryPeerReviews.some(
				(pr) => pr.report_id === reportId && pr.reviewer_address === reviewerAddress,
			)
		) {
			return { ok: false, code: "ALREADY_REVIEWED" }
		}
		inMemoryPeerReviews.push({
			id: inMemoryPeerSeq++,
			report_id: reportId,
			reviewer_address: reviewerAddress,
			verdict,
			comment,
			lrn_awarded: reward,
			created_at: new Date().toISOString(),
		})
		return { ok: true, lrn_awarded: reward }
	}

	const client = await pool.connect()
	try {
		await client.query("BEGIN")

		const repRes = await client.query<{
			id: number
			status: string
			scholar_address: string
			course_id: string
		}>(
			`SELECT id, status, scholar_address, course_id
       FROM milestone_reports WHERE id = $1 FOR UPDATE`,
			[reportId],
		)
		const report = repRes.rows[0]
		if (!report) {
			await client.query("ROLLBACK")
			return { ok: false, code: "NOT_FOUND" }
		}
		if (report.status !== "pending") {
			await client.query("ROLLBACK")
			return { ok: false, code: "NOT_PENDING" }
		}
		if (report.scholar_address === reviewerAddress) {
			await client.query("ROLLBACK")
			return { ok: false, code: "SELF_REVIEW" }
		}

		const enrollRes = await client.query(
			`SELECT 1 FROM enrollments
       WHERE learner_address = $1 AND course_id = $2 LIMIT 1`,
			[reviewerAddress, report.course_id],
		)
		if (enrollRes.rows.length > 0) {
			await client.query("ROLLBACK")
			return { ok: false, code: "SAME_COURSE" }
		}

		const balRes = await client.query<{ bal: string }>(
			`SELECT COALESCE(lrn_balance, 0)::text AS bal FROM scholar_balances WHERE address = $1`,
			[reviewerAddress],
		)
		const balStr = balRes.rows[0]?.bal ?? "0"
		let eligible = false
		try {
			eligible = BigInt(balStr.split(".")[0] ?? "0") >= BigInt(minLrnThreshold())
		} catch {
			eligible = false
		}
		if (!eligible) {
			await client.query("ROLLBACK")
			return { ok: false, code: "INSUFFICIENT_REPUTATION" }
		}

		try {
			await client.query(
				`INSERT INTO milestone_peer_reviews
         (report_id, reviewer_address, verdict, comment, lrn_awarded)
       VALUES ($1, $2, $3, $4, $5::numeric)`,
				[reportId, reviewerAddress, verdict, comment, reward],
			)
		} catch (err: any) {
			if (err?.code === "23505") {
				await client.query("ROLLBACK")
				return { ok: false, code: "ALREADY_REVIEWED" }
			}
			throw err
		}

		await client.query(
			`INSERT INTO scholar_balances (address, lrn_balance, courses_completed, updated_at)
       VALUES ($1, $2::numeric, 0, NOW())
       ON CONFLICT (address) DO UPDATE SET
         lrn_balance = scholar_balances.lrn_balance + EXCLUDED.lrn_balance,
         updated_at = NOW()`,
			[reviewerAddress, reward],
		)

		await client.query(
			`INSERT INTO platform_events (event_type, data)
       VALUES ('peer_review_completed', $1::jsonb)`,
			[
				JSON.stringify({
					report_id: reportId,
					reviewer_address: reviewerAddress,
					verdict,
					lrn_awarded: reward,
				}),
			],
		)

		await client.query("COMMIT")
		return { ok: true, lrn_awarded: reward }
	} catch (err) {
		await client.query("ROLLBACK").catch(() => {})
		throw err
	} finally {
		client.release()
	}
}
