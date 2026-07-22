import { type Response } from "express"
import sanitizeHtml from "sanitize-html"
import { milestoneStore } from "../db/milestone-store"
import { createNotification } from "../db/notifications-store"
import { logger } from "../lib/logger"
import { type AdminRequest } from "../middleware/admin.middleware"
import { type AuthRequest } from "../middleware/auth.middleware"
import { createEmailService } from "../services/email.service"
import { deliverNotificationChannels } from "../services/notification-delivery.service"
import { stellarContractService } from "../services/stellar-contract.service"
import { recordMilestoneActivity } from "../services/streak.service"

const log = logger.child({ module: "milestone-appeal" })

const emailService = createEmailService(
	process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || "",
)

const SECOND_TIER_VALIDATOR_ADDRESS =
	process.env.SECOND_TIER_VALIDATOR_ADDRESS ?? ""

function hasStellarMilestoneCredentials(): boolean {
	return Boolean(
		process.env.STELLAR_SECRET_KEY && process.env.COURSE_MILESTONE_CONTRACT_ID,
	)
}

/**
 * POST /api/milestones/:id/appeal
 * Scholar submits an appeal for a rejected milestone report.
 * Requires the authenticated wallet to match the report's scholar_address.
 */
export async function appealMilestone(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const id = Number(req.params.id)
	if (!Number.isInteger(id) || id <= 0) {
		res.status(400).json({ error: "Invalid milestone report id" })
		return
	}

	const scholarAddress = req.user?.address
	if (!scholarAddress) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const { reason } = req.body as { reason?: unknown }
	if (!reason || typeof reason !== "string") {
		res.status(400).json({ error: "Appeal reason is required" })
		return
	}
	if (reason.length > 2000) {
		res
			.status(400)
			.json({ error: "Appeal reason must be 2000 characters or fewer" })
		return
	}
	const sanitizedReason = sanitizeHtml(reason.trim(), {
		allowedTags: [],
		allowedAttributes: {},
	})
	if (!sanitizedReason) {
		res.status(400).json({ error: "Appeal reason is required" })
		return
	}

	try {
		const report = await milestoneStore.getReportById(id)
		if (!report) {
			res.status(404).json({ error: "Milestone report not found" })
			return
		}
		if (report.scholar_address !== scholarAddress) {
			res.status(403).json({ error: "Forbidden" })
			return
		}
		if (report.status !== "rejected") {
			res.status(409).json({
				error: `Cannot appeal a report with status "${report.status}". Only rejected reports can be appealed.`,
			})
			return
		}

		// appeal_milestone on-chain requires learner auth — this must be submitted
		// from the frontend wallet directly. Backend records the appeal in DB only.
		const updated = await milestoneStore.submitAppeal(id, sanitizedReason)
		if (!updated) {
			res.status(409).json({
				error:
					"Appeal could not be submitted. The report may no longer be in rejected state.",
			})
			return
		}

		await milestoneStore.addAuditEntry({
			report_id: id,
			validator_address: scholarAddress,
			decision: "rejected",
			rejection_reason: `Appeal submitted: ${sanitizedReason}`,
			contract_tx_hash: null,
		})

		// Notify second-tier validator if configured
		if (SECOND_TIER_VALIDATOR_ADDRESS) {
			void createNotification({
				recipient_address: SECOND_TIER_VALIDATOR_ADDRESS,
				type: "milestone_appeal",
				message: `A milestone appeal has been submitted for report #${id} (course: ${report.course_id}, milestone: ${report.milestone_id}). Reason: ${sanitizedReason}`,
				href: `/admin/milestones/${id}`,
				data: {
					report_id: id,
					course_id: report.course_id,
					milestone_id: report.milestone_id,
					scholar_address: scholarAddress,
					appeal_reason: sanitizedReason,
				},
			})
			void deliverNotificationChannels({
				recipientAddress: SECOND_TIER_VALIDATOR_ADDRESS,
				type: "milestone_appeal",
				title: "Milestone Appeal Filed",
				message: `Report #${id} for course "${report.course_title ?? report.course_id}" has been appealed.`,
				href: `/admin/milestones/${id}`,
				email: undefined,
			})
		}

		res.status(200).json({
			data: {
				reportId: id,
				status: "appealed",
				appealReason: sanitizedReason,
				appealSubmittedAt: updated.appeal_submitted_at,
			},
		})
	} catch (err) {
		log.error({ err }, "appealMilestone error")
		res.status(500).json({ error: "Failed to submit appeal" })
	}
}

/**
 * POST /api/admin/milestones/:id/resolve-appeal
 * Admin resolves an appeal: approved → mints LRN; final_rejected → closes.
 */
export async function resolveAppeal(
	req: AdminRequest,
	res: Response,
): Promise<void> {
	const id = Number(req.params.id)
	if (!Number.isInteger(id) || id <= 0) {
		res.status(400).json({ error: "Invalid milestone report id" })
		return
	}

	const validatorAddress = req.adminAddress ?? "unknown"
	const { approved, reason } = req.body as {
		approved?: unknown
		reason?: unknown
	}

	if (typeof approved !== "boolean") {
		res.status(400).json({ error: "approved (boolean) is required" })
		return
	}
	if (!approved) {
		if (!reason || typeof reason !== "string" || !reason.trim()) {
			res
				.status(400)
				.json({ error: "reason is required when rejecting an appeal" })
			return
		}
		if (reason.length > 1000) {
			res.status(400).json({ error: "reason must be 1000 characters or fewer" })
			return
		}
	}

	const sanitizedReason =
		typeof reason === "string"
			? sanitizeHtml(reason.trim(), { allowedTags: [], allowedAttributes: {} })
			: undefined

	try {
		const report = await milestoneStore.getReportById(id)
		if (!report) {
			res.status(404).json({ error: "Milestone report not found" })
			return
		}
		if (report.status !== "appealed") {
			res.status(409).json({
				error: `Report status is "${report.status}", expected "appealed"`,
			})
			return
		}

		let contractTxHash: string | null = null

		if (approved) {
			// Approve: call verify_milestone on chain to mint LRN
			if (hasStellarMilestoneCredentials()) {
				try {
					const result = await stellarContractService.callVerifyMilestone(
						report.scholar_address,
						report.course_id,
						report.milestone_id,
						{ requestId: req.requestId },
					)
					contractTxHash = result.txHash ?? null
				} catch (contractErr) {
					log.error(
						{ err: contractErr },
						"resolve_appeal verify_milestone contract call failed",
					)
					res.status(502).json({
						error: "Contract call failed. Appeal resolution not committed.",
					})
					return
				}
			}
			await milestoneStore.updateReportStatus(id, "approved")
			try {
				await recordMilestoneActivity(report.scholar_address)
			} catch (streakErr) {
				log.error(
					{ err: streakErr },
					"streak activity update failed (non-blocking)",
				)
			}
		} else {
			// Final rejection: emit on-chain rejection event (non-blocking)
			if (hasStellarMilestoneCredentials()) {
				try {
					await stellarContractService.emitRejectionEvent(
						report.scholar_address,
						report.course_id,
						report.milestone_id,
						sanitizedReason ?? "Appeal rejected",
						{ requestId: req.requestId },
					)
				} catch (contractErr) {
					log.warn(
						{ err: contractErr },
						"resolve_appeal rejection event failed (non-blocking)",
					)
				}
			}
			await milestoneStore.updateReportStatus(id, "final_rejected")
		}

		const auditEntry = await milestoneStore.addAuditEntry({
			report_id: id,
			validator_address: validatorAddress,
			decision: approved ? "appeal_approved" : "appeal_rejected",
			rejection_reason: approved ? null : (sanitizedReason ?? null),
			contract_tx_hash: contractTxHash,
		})

		const decisionLabel = approved ? "approved" : "finally rejected"
		void createNotification({
			recipient_address: report.scholar_address,
			type: approved
				? "milestone_appeal_approved"
				: "milestone_appeal_rejected",
			message: `Your appeal for "${report.milestone_title ?? `Milestone ${report.milestone_id}`}" (course: ${report.course_title ?? report.course_id}) has been ${decisionLabel}.${!approved && sanitizedReason ? ` Reason: ${sanitizedReason}` : ""}`,
			href: "/scholar/milestones",
			data: {
				report_id: id,
				course_id: report.course_id,
				milestone_id: report.milestone_id,
				approved,
				contract_tx_hash: contractTxHash,
			},
		})
		void deliverNotificationChannels({
			recipientAddress: report.scholar_address,
			type: approved
				? "milestone_appeal_approved"
				: "milestone_appeal_rejected",
			title: approved ? "Appeal Approved" : "Appeal Rejected",
			message: `Your milestone appeal has been ${decisionLabel}.`,
			href: "/scholar/milestones",
			email: report.scholar_email,
		})

		res.status(200).json({
			data: {
				reportId: id,
				status: approved ? "approved" : "final_rejected",
				approved,
				contractTxHash,
				auditEntry,
			},
		})
	} catch (err) {
		log.error({ err }, "resolveAppeal error")
		res.status(500).json({ error: "Failed to resolve appeal" })
	}
}
