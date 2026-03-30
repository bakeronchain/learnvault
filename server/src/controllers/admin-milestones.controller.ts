import { type Request, type Response } from "express"
import { milestoneStore } from "../db/milestone-store"
import { type AdminRequest } from "../middleware/admin.middleware"
import { credentialService } from "../services/credential.service"
import { createEmailService } from "../services/email.service"
import { stellarContractService } from "../services/stellar-contract.service"
import { templates, toPlainText } from "../templates/email-templates"

const emailService = createEmailService(
	process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || "",
)

type MilestoneStatusFilter = "pending" | "approved" | "rejected"

function hasStellarMilestoneCredentials(): boolean {
	return Boolean(
		process.env.STELLAR_SECRET_KEY && process.env.COURSE_MILESTONE_CONTRACT_ID,
	)
}

// ── GET /api/admin/milestones/pending ────────────────────────────────────────

export async function listMilestones(
	req: Request,
	res: Response,
): Promise<void> {
	const page =
		typeof req.query.page === "string"
			? Number.parseInt(req.query.page, 10)
			: 1
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
		console.error("[admin] listMilestones error:", err)
		res.status(500).json({ error: "Failed to fetch milestones" })
	}
}

export async function getPendingMilestones(
	_req: Request,
	res: Response,
): Promise<void> {
	try {
		const reports = await milestoneStore.getPendingReports()
		res.status(200).json({ data: reports })
	} catch (err) {
		console.error("[admin] getPendingMilestones error:", err)
		res.status(500).json({ error: "Failed to fetch pending milestones" })
	}
}

export async function getMilestoneById(
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
		console.error("[admin] getMilestoneById error:", err)
		res.status(500).json({ error: "Failed to fetch milestone report" })
	}
}

export async function approveMilestone(
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
		)

		// Persist decision
		await milestoneStore.updateReportStatus(id, "approved")
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
			console.error("[admin] approval email failed (non-blocking):", emailErr)
		}

		let certificate = null
		try {
			const mintResult = await credentialService.mintCertificateIfComplete(
				report.scholar_address,
				report.course_id,
			)
			if (mintResult.minted) {
				certificate = mintResult
				console.info(
					`[admin] ScholarNFT minted for ${report.scholar_address} — course ${report.course_id} (tx: ${mintResult.mintTxHash})`,
				)
			}
		} catch (mintErr) {
			console.error("[admin] Certificate mint failed (non-blocking):", mintErr)
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
		console.error("[admin] approveMilestone error:", err)
		const msg = err instanceof Error ? err.message : String(err)
		if (msg.includes("not configured")) {
			res.status(503).json({ error: "Stellar credentials not configured" })
			return
		}
		res.status(500).json({ error: "Failed to approve milestone" })
	}
}

export async function rejectMilestone(
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
		)

		// Persist decision
		await milestoneStore.updateReportStatus(id, "rejected")
		const auditEntry = await milestoneStore.addAuditEntry({
			report_id: id,
			validator_address: validatorAddress,
			decision: "rejected",
			rejection_reason: reason,
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
						rejectionReason: reason || "",
						milestoneUrl: `${process.env.FRONTEND_URL || ""}/milestones`,
						unsubscribeUrl: "#",
					},
				})
			}
		} catch (emailErr) {
			console.error("[admin] rejection email failed (non-blocking):", emailErr)
		}

		console.info(
			`[admin] Scholar ${report.scholar_address} notified of rejection for milestone ${report.milestone_id} in course ${report.course_id}`,
		)

		res.status(200).json({
			data: {
				reportId: id,
				status: "rejected",
				reason,
				contractTxHash: contractResult.txHash,
				simulated: contractResult.simulated,
				auditEntry,
			},
		})
	} catch (err) {
		console.error("[admin] rejectMilestone error:", err)
		const msg = err instanceof Error ? err.message : String(err)
		if (msg.includes("not configured")) {
			res.status(503).json({ error: "Stellar credentials not configured" })
			return
		}
		res.status(500).json({ error: "Failed to reject milestone" })
	}
}
