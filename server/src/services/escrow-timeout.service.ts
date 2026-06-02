import { pool } from "../db/index"
import { createEmailService } from "./email.service"
import { stellarContractService } from "./stellar-contract.service"

const DAY_MS = 24 * 60 * 60 * 1000
const REMINDER_THRESHOLD_DAYS = 7

export type EscrowTimeoutStatus = {
	proposalId: number
	scholarAddress: string
	courseId: string | null
	daysRemaining: number
	inactivityWindowDays: number
	lastActivityAt: string
	deadlineAt: string
	reminderSentAt: string | null
	status: "active" | "reclaimed"
}

type EscrowTimeoutRow = {
	proposal_id: number
	scholar_address: string
	scholar_email: string | null
	course_id: string | null
	inactivity_window_days: number
	last_activity_at: Date | string
	status: "active" | "reclaimed"
	reminder_sent_at: Date | string | null
}

const emailService = createEmailService(
	process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || "",
)

function toDate(value: Date | string): Date {
	return value instanceof Date ? value : new Date(value)
}

function computeDaysRemaining(
	lastActivityAt: Date,
	windowDays: number,
): number {
	const deadline = lastActivityAt.getTime() + windowDays * DAY_MS
	return Math.ceil((deadline - Date.now()) / DAY_MS)
}

function toStatus(row: EscrowTimeoutRow): EscrowTimeoutStatus {
	const lastActivity = toDate(row.last_activity_at)
	const deadline = new Date(
		lastActivity.getTime() + row.inactivity_window_days * DAY_MS,
	)
	return {
		proposalId: row.proposal_id,
		scholarAddress: row.scholar_address,
		courseId: row.course_id,
		daysRemaining: computeDaysRemaining(
			lastActivity,
			row.inactivity_window_days,
		),
		inactivityWindowDays: row.inactivity_window_days,
		lastActivityAt: lastActivity.toISOString(),
		deadlineAt: deadline.toISOString(),
		reminderSentAt: row.reminder_sent_at
			? toDate(row.reminder_sent_at).toISOString()
			: null,
		status: row.status,
	}
}

async function insertPlatformEvent(
	eventType: string,
	data: Record<string, unknown>,
): Promise<void> {
	await pool.query(
		`INSERT INTO platform_events (event_type, data) VALUES ($1, $2::jsonb)`,
		[eventType, JSON.stringify(data)],
	)
}

async function notifyEscrowTimeoutWarning(
	row: EscrowTimeoutRow,
): Promise<void> {
	const status = toStatus(row)
	const milestoneUrl = `${process.env.FRONTEND_URL || ""}/dashboard`

	if (row.scholar_email) {
		await emailService.sendNotification({
			to: row.scholar_email,
			subject: "Milestone escrow timeout approaching",
			template: "inactivity-reminder",
			data: {
				name: row.scholar_address,
				milestoneTitle: row.course_id || `Proposal ${row.proposal_id}`,
				milestoneUrl,
				unsubscribeUrl: "#",
			},
		})
	}

	await insertPlatformEvent("escrow_timeout_warning", {
		proposal_id: row.proposal_id,
		scholar_address: row.scholar_address,
		course_id: row.course_id,
		days_remaining: status.daysRemaining,
		recipient_type: "scholar",
		recipient_address: row.scholar_address,
	})

	const voters = await pool.query<{ voter_address: string }>(
		`SELECT voter_address FROM votes WHERE proposal_id = $1`,
		[row.proposal_id],
	)

	for (const vote of voters.rows) {
		await insertPlatformEvent("escrow_timeout_warning", {
			proposal_id: row.proposal_id,
			scholar_address: row.scholar_address,
			course_id: row.course_id,
			days_remaining: status.daysRemaining,
			recipient_type: "donor",
			recipient_address: vote.voter_address,
		})
	}
}

async function reclaimExpiredEscrow(row: EscrowTimeoutRow): Promise<void> {
	const contractResult = await stellarContractService.reclaimInactiveEscrow(
		row.proposal_id,
	)

	await pool.query(
		`UPDATE escrow_timeouts
		 SET status = 'reclaimed',
		     reclaimed_at = NOW(),
		     last_check_at = NOW(),
		     reclaim_tx_hash = $2
		 WHERE proposal_id = $1`,
		[row.proposal_id, contractResult.txHash],
	)

	await insertPlatformEvent("escrow_reclaimed", {
		proposal_id: row.proposal_id,
		scholar_address: row.scholar_address,
		course_id: row.course_id,
		tx_hash: contractResult.txHash,
	})
}

export async function trackEscrowTimeout(input: {
	proposalId: number
	scholarAddress: string
	scholarEmail?: string | null
	courseId?: string | null
	inactivityWindowDays?: number
}): Promise<void> {
	await pool.query(
		`INSERT INTO escrow_timeouts (
			proposal_id,
			scholar_address,
			scholar_email,
			course_id,
			inactivity_window_days,
			last_activity_at
		 ) VALUES ($1, $2, $3, $4, $5, NOW())
		 ON CONFLICT (proposal_id)
		 DO UPDATE
		 SET scholar_address = EXCLUDED.scholar_address,
		     scholar_email = COALESCE(EXCLUDED.scholar_email, escrow_timeouts.scholar_email),
		     course_id = COALESCE(EXCLUDED.course_id, escrow_timeouts.course_id),
		     inactivity_window_days = EXCLUDED.inactivity_window_days,
		     last_activity_at = NOW(),
		     status = 'active',
		     reclaimed_at = NULL,
		     reclaim_tx_hash = NULL`,
		[
			input.proposalId,
			input.scholarAddress,
			input.scholarEmail ?? null,
			input.courseId ?? null,
			input.inactivityWindowDays ?? 30,
		],
	)
}

export async function markEscrowActivity(
	scholarAddress: string,
	courseId: string,
): Promise<void> {
	await pool.query(
		`UPDATE escrow_timeouts
		 SET last_activity_at = NOW(),
		     reminder_sent_at = NULL,
		     status = 'active'
		 WHERE scholar_address = $1
		   AND course_id = $2
		   AND status = 'active'`,
		[scholarAddress, courseId],
	)
}

export async function listEscrowTimeoutsForScholar(
	scholarAddress: string,
): Promise<EscrowTimeoutStatus[]> {
	const result = await pool.query<EscrowTimeoutRow>(
		`SELECT proposal_id, scholar_address, scholar_email, course_id, inactivity_window_days, last_activity_at, status, reminder_sent_at
		 FROM escrow_timeouts
		 WHERE scholar_address = $1
		 ORDER BY last_activity_at DESC`,
		[scholarAddress],
	)

	return result.rows.map(toStatus)
}

export async function processEscrowTimeouts(): Promise<void> {
	let result
	try {
		result = await pool.query<EscrowTimeoutRow>(
			`SELECT proposal_id, scholar_address, scholar_email, course_id, inactivity_window_days, last_activity_at, status, reminder_sent_at
			 FROM escrow_timeouts
			 WHERE status = 'active'
			 ORDER BY last_activity_at ASC`,
		)
	} catch (err) {
		console.error("[escrow-timeout] query failed:", err)
		return
	}

	for (const row of result.rows) {
		const status = toStatus(row)
		try {
			if (status.daysRemaining <= 0) {
				await reclaimExpiredEscrow(row)
				continue
			}

			const alreadyReminded = Boolean(row.reminder_sent_at)
			if (status.daysRemaining <= REMINDER_THRESHOLD_DAYS && !alreadyReminded) {
				await notifyEscrowTimeoutWarning(row)
				await pool.query(
					`UPDATE escrow_timeouts
					 SET reminder_sent_at = NOW(),
					     last_check_at = NOW()
					 WHERE proposal_id = $1`,
					[row.proposal_id],
				)
			} else {
				await pool.query(
					`UPDATE escrow_timeouts SET last_check_at = NOW() WHERE proposal_id = $1`,
					[row.proposal_id],
				)
			}
		} catch (err) {
			console.error("[escrow-timeout] processing failed:", {
				proposalId: row.proposal_id,
				err,
			})
		}
	}
}
