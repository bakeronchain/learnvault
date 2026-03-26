import { type Request, type Response } from "express"
import { milestoneStore } from "../db/milestone-store"
import { type AdminRequest } from "../middleware/admin.middleware"
import { credentialService } from "../services/credential.service"
import { stellarContractService } from "../services/stellar-contract.service"

// ── GET /api/admin/milestones/pending ────────────────────────────────────────

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

		// TODO: send email notification to scholar (integrate email service here)
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
		res.status(500).json({ error: "Failed to reject milestone" })
	}
}
