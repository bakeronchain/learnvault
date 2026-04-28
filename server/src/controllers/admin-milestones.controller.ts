import { type Request, type Response } from "express"
import sanitizeHtml from "sanitize-html"
import { milestoneStore, type MilestoneReport } from "../db/milestone-store"
import { createLogger, logger } from "../lib/logger"

import { type AdminRequest } from "../middleware/admin.middleware"
import { credentialService } from "../services/credential.service"
import { createEmailService } from "../services/email.service"
import { markEscrowActivity } from "../services/escrow-timeout.service"
import { stellarContractService } from "../services/stellar-contract.service"
import { templates, toPlainText } from "../templates/email-templates"

// const log = logger.child({ module: "admin-milestones" })
const emailService = createEmailService(
	process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || "",
)

type MilestoneStatusFilter = "pending" | "approved" | "rejected"

function hasStellarMilestoneCredentials (): boolean {
	return Boolean(
		process.env.STELLAR_SECRET_KEY && process.env.COURSE_MILESTONE_CONTRACT_ID,
	)
}

// const logger = createLogger("admin-milestones")

// ── GET /api/admin/milestones/pending ────────────────────────────────────────

export async function listMilestones (
	req: Request,
	res: Response,
): Promise<void> {
	const page =
		typeof req.query.page === "string" ? Number.parseInt(req.query.page, 10) : 1
	const pageSize =
		typeof req.query.pageSize === "string"
			? Number.parseInt(req.query.pageSize, 10)
			: 10
	const courseId =
		typeof req.query.course === "string" ? req.query.course : undefined
	const status =
		typeof req.query.status === "string"
			? (req.query.status as MilestoneStatusFilter)
			: undefined

	if (
		status &&
		status !== "pending" &&
		status !== "approved" &&
		status !== "rejected"
	) {
		res.status(400).json({ error: "Invalid milestone status filter" })
		return
	}

	try {
		const safePage = Number.isFinite(page) && page > 0 ? page : 1
		const safePageSize =
			Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 10
		const result = await milestoneStore.listReports(
			{
				courseId,
				status,
			},
			safePage,
			safePageSize,
		)

		res.status(200).json({
			data: result.data,
			total: result.total,
			page: safePage,
			pageSize: safePageSize,
		})
	} catch (err) {
		log.error({ err }, "listMilestones error")
		res.status(500).json({ error: "Failed to fetch milestones" })
	}
}

export async function getPendingMilestones (
	_req: Request,
	res: Response,
): Promise<void> {
	try {
		const reports = await milestoneStore.getPendingReports()
		res.status(200).json({ data: reports })
	} catch (err) {
		log.error({ err }, "getPendingMilestones error")
		res.status(500).json({ error: "Failed to fetch pending milestones" })
	}
}

export async function getMilestoneById (
	req: Request,
	res: Response,
): Promise<void> {
	const id = Number(req.params.id)
	if (!Number.isInteger(id) || id <= 0) {
		res.status(400).json({ error: "Invalid milestone report id" })
		return
	}

	try {
		const report = await milestoneStore.getReportById(id)
		if (!report) {
			res.status(404).json({ error: "Milestone report not found" })
			return
		}
		const auditLog = await milestoneStore.getAuditForReport(id)
		res.status(200).json({ data: { ...report, auditLog } })
	} catch (err) {
		log.error({ err }, "getMilestoneById error")
		res.status(500).json({ error: "Failed to fetch milestone report" })
	}
}

export async function approveMilestone (
	req: AdminRequest,
	res: Response,
): Promise<void> {
	const id = Number(req.params.id)
	if (!Number.isInteger(id) || id <= 0) {
		res.status(400).json({ error: "Invalid milestone report id" })
		return
	}

	const validatorAddress = req.adminAddress ?? "unknown"

	try {
		const report = await milestoneStore.getReportById(id)
		if (!report) {
			res.status(404).json({ error: "Milestone report not found" })
			return
		}
		if (report.status !== "pending") {
			res.status(409).json({ error: `Report already ${report.status}` })
			return
		}
		if (!hasStellarMilestoneCredentials()) {
			res.status(503).json({ error: "Stellar credentials not configured" })
			return
		}

		// Trigger on-chain verify_milestone() call
		const contractResult = await stellarContractService.callVerifyMilestone(
			report.scholar_address,
			report.course_id,
			report.milestone_id,
			{ requestId: req.requestId },
		)

		// Persist decision
		await milestoneStore.updateReportStatus(id, "approved")
		try {
			await markEscrowActivity(report.scholar_address, report.course_id)
		} catch (trackingErr) {
			logger.error("Escrow activity update failed", {
				error: trackingErr,
				reportId: id,
			})
		}
		const auditEntry = await milestoneStore.addAuditEntry({
			report_id: id,
			validator_address: validatorAddress,
			decision: "approved",
			rejection_reason: null,
			contract_tx_hash: contractResult.txHash,
		})

		try {
			if (report.scholar_email) {
				await emailService.sendNotification({
					to: report.scholar_email,
					subject: "Milestone Approved ",
					template: "milestone-approved-admin",
					data: {
						name: report.scholar_name || "Scholar",
						courseTitle: report.course_title || `Course ${report.course_id}`,
						milestoneTitle:
							report.milestone_title ||
							`Milestone ${report.milestone_number ?? report.milestone_id}`,
						milestoneNumber: String(
							report.milestone_number ?? report.milestone_id,
						),
						reward: String(report.lrn_reward ?? 0),
						dashboardUrl: `${process.env.FRONTEND_URL || ""}/dashboard`,
						unsubscribeUrl: "#",
					},
				})
			}
		} catch (emailErr) {
			log.error({ err: emailErr }, "Approval email failed (non-blocking)")
		}

		let certificate = null
		try {
			const mintResult = await credentialService.mintCertificateIfComplete(
				report.scholar_address,
				report.course_id,
			)
			if (mintResult.minted) {
				certificate = mintResult
				log.info(
					{ courseId: report.course_id, txHash: mintResult.mintTxHash },
					"ScholarNFT minted",
				)
			}
		} catch (mintErr) {
			log.error({ err: mintErr }, "Certificate mint failed (non-blocking)")
		}

		res.status(200).json({
			data: {
				reportId: id,
				status: "approved",
				contractTxHash: contractResult.txHash,
				simulated: contractResult.simulated,
				auditEntry,
				certificate,
			},
		})
	} catch (err) {
		log.error({ err }, "approveMilestone error")
		const msg = err instanceof Error ? err.message : String(err)
		if (msg.includes("not configured")) {
			res.status(503).json({ error: "Stellar credentials not configured" })
			return
		}
		res.status(500).json({ error: "Failed to approve milestone" })
	}
}

export async function rejectMilestone (
	req: AdminRequest,
	res: Response,
): Promise<void> {
	const id = Number(req.params.id)
	if (!Number.isInteger(id) || id <= 0) {
		res.status(400).json({ error: "Invalid milestone report id" })
		return
	}

	const { reason } = req.body as { reason: string }
	const validatorAddress = req.adminAddress ?? "unknown"

	// Validate and sanitize rejection reason
	if (!reason || typeof reason !== "string") {
		res.status(400).json({ error: "Rejection reason is required" })
		return
	}
	if (reason.length > 1000) {
		res
			.status(400)
			.json({ error: "Rejection reason must be 1000 characters or fewer" })
		return
	}
	const sanitizedReason = sanitizeHtml(reason, {
		allowedTags: [],
		allowedAttributes: {},
	})

	try {
		const report = await milestoneStore.getReportById(id)
		if (!report) {
			res.status(404).json({ error: "Milestone report not found" })
			return
		}
		if (report.status !== "pending") {
			res.status(409).json({ error: `Report already ${report.status}` })
			return
		}
		if (!hasStellarMilestoneCredentials()) {
			res.status(503).json({ error: "Stellar credentials not configured" })
			return
		}

		// Emit on-chain rejection event
		const contractResult = await stellarContractService.emitRejectionEvent(
			report.scholar_address,
			report.course_id,
			report.milestone_id,
			reason,
			{ requestId: req.requestId },
		)

		// Persist decision
		await milestoneStore.updateReportStatus(id, "rejected")
		try {
			await markEscrowActivity(report.scholar_address, report.course_id)
		} catch (trackingErr) {
			logger.error("Escrow activity update failed", {
				error: trackingErr,
				reportId: id,
			})
		}
		const auditEntry = await milestoneStore.addAuditEntry({
			report_id: id,
			validator_address: validatorAddress,
			decision: "rejected",
			rejection_reason: sanitizedReason,
			contract_tx_hash: contractResult.txHash,
		})

		try {
			if (report.scholar_email) {
				await emailService.sendNotification({
					to: report.scholar_email,
					subject: "Milestone Rejected",
					template: "milestone-rejected-admin",
					data: {
						name: report.scholar_name || "Scholar",
						courseTitle: report.course_title || `Course ${report.course_id}`,
						milestoneTitle:
							report.milestone_title ||
							`Milestone ${report.milestone_number ?? report.milestone_id}`,
						milestoneNumber: String(
							report.milestone_number ?? report.milestone_id,
						),
						rejectionReason: sanitizedReason,
						milestoneUrl: `${process.env.FRONTEND_URL || ""}/milestones`,
						unsubscribeUrl: "#",
					},
				})
			}
		} catch (emailErr) {
			log.error({ err: emailErr }, "Rejection email failed (non-blocking)")
		}

		log.info(
			{ milestoneId: report.milestone_id, courseId: report.course_id },
			"Scholar notified of rejection",
		)

		res.status(200).json({
			data: {
				reportId: id,
				status: "rejected",
				reason: sanitizedReason,
				contractTxHash: contractResult.txHash,
				simulated: contractResult.simulated,
				auditEntry,
			},
		})
	} catch (err) {
		log.error({ err }, "rejectMilestone error")
		const msg = err instanceof Error ? err.message : String(err)
		if (msg.includes("not configured")) {
			res.status(503).json({ error: "Stellar credentials not configured" })
			return
		}
		res.status(500).json({ error: "Failed to reject milestone" })
	}
}

export async function batchApproveMilestones (
	req: AdminRequest,
	res: Response,
): Promise<void> {
	const { milestoneIds } = req.body as { milestoneIds: number[] }
	if (!Array.isArray(milestoneIds) || milestoneIds.length === 0) {
		res.status(400).json({ error: "milestoneIds must be a non-empty array" })
		return
	}

	const validatorAddress = req.adminAddress ?? "unknown"

	// Pre-flight: fetch all reports and check existence
	const reports = await Promise.all(
		milestoneIds.map((id) => milestoneStore.getReportById(id)),
	)
	const notFound = milestoneIds.filter((id, i) => !reports[i])
	if (notFound.length > 0) {
		res.status(404).json({
			error: "One or more milestone reports were not found",
			data: {
				results: notFound.map((id) => ({
					reportId: id,
					success: false,
					status: "not_found",
				})),
			},
		})
		return
	}

	if (!hasStellarMilestoneCredentials()) {
		res.status(503).json({ error: "Stellar credentials not configured" })
		return
	}

	const results = []
	let succeeded = 0
	let failed = 0

	for (let i = 0; i < milestoneIds.length; i++) {
		const id = milestoneIds[i]
		const report = reports[i]!
		try {
			if (report.status !== "pending") {
				results.push({ reportId: id, success: false, status: report.status })
				failed++
				continue
			}
			const contractResult = await stellarContractService.callVerifyMilestone(
				report.scholar_address,
				report.course_id,
				report.milestone_id,
				{ requestId: req.requestId },
			)
			await milestoneStore.updateReportStatus(id, "approved")
			await milestoneStore.addAuditEntry({
				report_id: id,
				validator_address: validatorAddress,
				decision: "approved",
				rejection_reason: null,
				contract_tx_hash: contractResult.txHash,
			})
			results.push({
				reportId: id,
				success: true,
				status: "approved",
				contractTxHash: contractResult.txHash,
			})
			succeeded++
		} catch {
			results.push({ reportId: id, success: false, status: "failed" })
			failed++
		}
	}

	res.status(200).json({
		data: {
			action: "approve",
			totalRequested: milestoneIds.length,
			processed: milestoneIds.length,
			succeeded,
			failed,
			results,
		},
	})
}

export async function batchRejectMilestones (
	req: AdminRequest,
	res: Response,
): Promise<void> {
	const { milestoneIds, reason = "Rejected from the admin panel" } =
		req.body as { milestoneIds: number[]; reason?: string }

	if (!Array.isArray(milestoneIds) || milestoneIds.length === 0) {
		res.status(400).json({ error: "milestoneIds must be a non-empty array" })
		return
	}

	const validatorAddress = req.adminAddress ?? "unknown"

	const reports = await Promise.all(
		milestoneIds.map((id) => milestoneStore.getReportById(id)),
	)

	// Check all are pending before processing any
	const nonPending = reports
		.map((r, i) => ({ report: r, id: milestoneIds[i] }))
		.filter(({ report }) => report && report.status !== "pending")

	if (nonPending.length > 0) {
		res.status(409).json({
			error: "All milestone reports must be pending before batch processing",
			data: {
				results: nonPending.map(({ report, id }) => ({
					reportId: id,
					success: false,
					status: report!.status,
				})),
			},
		})
		return
	}

	if (!hasStellarMilestoneCredentials()) {
		res.status(503).json({ error: "Stellar credentials not configured" })
		return
	}

	const results = []
	let succeeded = 0
	let failed = 0

	for (let i = 0; i < milestoneIds.length; i++) {
		const id = milestoneIds[i]
		const report = reports[i]!
		try {
			const contractResult = await stellarContractService.emitRejectionEvent(
				report.scholar_address,
				report.course_id,
				report.milestone_id,
				reason,
				{ requestId: req.requestId },
			)
			await milestoneStore.updateReportStatus(id, "rejected")
			await milestoneStore.addAuditEntry({
				report_id: id,
				validator_address: validatorAddress,
				decision: "rejected",
				rejection_reason: reason,
				contract_tx_hash: contractResult.txHash,
			})
			results.push({
				reportId: id,
				success: true,
				status: "rejected",
				reason,
				contractTxHash: contractResult.txHash,
			})
			succeeded++
		} catch {
			results.push({ reportId: id, success: false, status: "failed" })
			failed++
		}
	}

	res.status(200).json({
		data: {
			action: "reject",
			totalRequested: milestoneIds.length,
			processed: milestoneIds.length,
			succeeded,
			failed,
			results,
		},
	})
}
