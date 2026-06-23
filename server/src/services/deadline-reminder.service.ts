import { pool } from "../db/index"
import { createNotification } from "../db/notifications-store"
import { deliverNotificationChannels } from "./notification-delivery.service"

const HOUR_MS = 60 * 60 * 1000

interface ProposalDeadlineRow {
	id: number
	title: string
	deadline: Date
	deadline_reminder_level: number
}

/**
 * Find governance participants (addresses that have voted or authored proposals)
 * who have NOT yet voted on the given proposal.
 */
async function findNonVoters(proposalId: number): Promise<string[]> {
	const result = await pool.query<{ address: string }>(
		`SELECT DISTINCT address FROM (
			SELECT author_address AS address FROM proposals
			UNION
			SELECT voter_address AS address FROM votes
		) participants
		WHERE address NOT IN (
			SELECT voter_address FROM votes WHERE proposal_id = $1
		)`,
		[proposalId],
	)
	return result.rows.map((r) => r.address)
}

function formatTimeRemaining(ms: number): string {
	const hours = Math.floor(ms / HOUR_MS)
	if (hours >= 24) {
		const days = Math.floor(hours / 24)
		const remainHours = hours % 24
		return remainHours > 0 ? `${days}d ${remainHours}h` : `${days}d`
	}
	const minutes = Math.floor((ms % HOUR_MS) / (60 * 1000))
	return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

/**
 * Core processing function: scan proposals approaching their deadline
 * and send reminders to eligible token holders who haven't voted.
 */
export async function processDeadlineReminders(): Promise<void> {
	let proposals
	try {
		proposals = await pool.query<ProposalDeadlineRow>(
			`SELECT id, title, deadline, deadline_reminder_level
			 FROM proposals
			 WHERE status = 'pending'
			   AND deadline IS NOT NULL
			   AND deadline > NOW()
			   AND deadline_reminder_level < 2
			 ORDER BY deadline ASC`,
		)
	} catch (err) {
		console.error("[deadline-reminder] query failed:", err)
		return
	}

	const now = Date.now()

	for (const proposal of proposals.rows) {
		const deadlineMs = new Date(proposal.deadline).getTime()
		const msUntilDeadline = deadlineMs - now

		try {
			// Determine which reminder level to send
			let targetLevel: number
			let timeLabel: string

			if (msUntilDeadline <= HOUR_MS && proposal.deadline_reminder_level < 2) {
				// Within 1 hour - send level 2 reminder
				targetLevel = 2
				timeLabel = formatTimeRemaining(msUntilDeadline)
			} else if (
				msUntilDeadline <= 24 * HOUR_MS &&
				proposal.deadline_reminder_level < 1
			) {
				// Within 24 hours - send level 1 reminder
				targetLevel = 1
				timeLabel = formatTimeRemaining(msUntilDeadline)
			} else {
				continue
			}

			const nonVoters = await findNonVoters(proposal.id)

			const proposalUrl = `${process.env.FRONTEND_URL || ""}/dao/proposals/${proposal.id}`

			for (const address of nonVoters) {
				void createNotification({
					recipient_address: address,
					type: "voting_deadline_reminder",
					message: `Voting on "${proposal.title}" closes in ${timeLabel}. Cast your vote before it's too late.`,
					href: `/dao/proposals/${proposal.id}`,
					data: {
						proposal_id: proposal.id,
						deadline: proposal.deadline.toISOString(),
						time_remaining: timeLabel,
						reminder_level: targetLevel,
					},
				})

				void deliverNotificationChannels({
					recipientAddress: address,
					type: "voting_deadline_reminder",
					title: `Voting closes in ${timeLabel}`,
					message: `Don't miss out — vote on "${proposal.title}" before the deadline.`,
					href: proposalUrl,
				})
			}

			// Update reminder level to prevent duplicate sends
			await pool.query(
				`UPDATE proposals
				 SET deadline_reminder_level = $1
				 WHERE id = $2`,
				[targetLevel, proposal.id],
			)
		} catch (err) {
			console.error("[deadline-reminder] processing failed:", {
				proposalId: proposal.id,
				err,
			})
		}
	}
}
