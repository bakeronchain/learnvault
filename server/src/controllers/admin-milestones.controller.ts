import { type Request, type Response } from "express"
import sanitizeHtml from "sanitize-html"
import { milestoneStore, type MilestoneReport } from "../db/milestone-store"
import {
	attachPeerSummariesToReports,
	listRecentPeerReviewsForReport,
} from "../db/peer-review-store"
import { type AdminRequest } from "../middleware/admin.middleware"
import { credentialService } from "../services/credential.service"
import { createEmailService } from "../services/email.service"
import { markEscrowActivity } from "../services/escrow-timeout.service"
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

		const dataWithPeers = await attachPeerSummariesToReports(result.data)

		res.status(200).json({
			data: dataWithPeers,
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
		const withPeers = await attachPeerSummariesToReports(reports)
		res.status(200).json({ data: withPeers })
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
		const [withPeers] = await attachPeerSummariesToReports([report])
		const peer_reviews = await listRecentPeerReviewsForReport(id, 20)
		res.status(200).json({
			data: { ...(withPeers ?? report), auditLog, peer_reviews },
		})
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
			{ requestId: req.requestId },
		)

		// Persist decision
		await milestoneStore.updateReportStatus(id, "approved")
		try {
			await markEscrowActivity(report.scholar_address, report.course_id)
		} catch (trackingErr) {
			console.error("[admin] escrow activity update failed:", trackingErr)
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
		const retriesExhausted =
			typeof err === "object" && err !== null && "retriesExhausted" in err
		if (msg.includes("not configured")) {
			res.status(503).json({ error: "Stellar credentials not configured" })
			return
		}
		res.status(500).json({
			error: "Failed to approve milestone",
			details: msg,
			retriesExhausted: retriesExhausted,
		})
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

	// Validate and sanitize rejection reason
	if (!reason || typeof reason !== "string") {
		res.status(400).json({ error: "Rejection reason is required" })
		return
	}
	if (reason.length > 1000) {
		res.status(400).json({ error: "Rejection reason must be 1000 characters or fewer" })
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
			console.error("[admin] escrow activity update failed:", trackingErr)
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
			console.error("[admin] rejection email failed (non-blocking):", emailErr)
		}

		console.info(
			`[admin] Scholar ${report.scholar_address} notified of rejection for milestone ${report.milestone_id} in course ${report.course_id}`,
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
		console.error("[admin] rejectMilestone error:", err)
		const msg = err instanceof Error ? err.message : String(err)
		const retriesExhausted =
			typeof err === "object" && err !== null && "retriesExhausted" in err
		if (msg.includes("not configured")) {
			res.status(503).json({ error: "Stellar credentials not configured" })
			return
		}
		res.status(500).json({
			error: "Failed to reject milestone",
			details: msg,
			retriesExhausted,
		})
	}
}

type BatchItemResult = {
	reportId: number
	success: boolean
	status: string
	reason?: string
}

export async function batchApproveMilestones(
	req: AdminRequest,
	res: Response,
): Promise<void> {
	const { milestoneIds } = req.body as { milestoneIds: number[] }
	const validatorAddress = req.adminAddress ?? "unknown"

	try {
		const loaded: Array<{ id: number; report: MilestoneReport | null }> = []
		for (const id of milestoneIds) {
			loaded.push({ id, report: await milestoneStore.getReportById(id) })
		}

		const missing = loaded.filter((x) => !x.report)
		if (missing.length > 0) {
			res.status(404).json({
				error: "One or more milestone reports were not found",
				data: {
					results: missing.map((m) => ({
						reportId: m.id,
						success: false,
						status: "not_found",
					})),
				},
			})
			return
		}

		const notPending = loaded.filter((x) => x.report!.status !== "pending")
		if (notPending.length > 0) {
			res.status(409).json({
				error: "One or more milestone reports are not pending",
				data: {
					results: notPending.map((x) => ({
						reportId: x.id,
						success: false,
						status: x.report!.status,
					})),
				},
			})
			return
		}

		if (!hasStellarMilestoneCredentials()) {
			res.status(503).json({ error: "Stellar credentials not configured" })
			return
		}

		const results: BatchItemResult[] = []
		let succeeded = 0

		for (const { id, report } of loaded) {
			const r = report!
			try {
				const contractResult = await stellarContractService.callVerifyMilestone(
					r.scholar_address,
					r.course_id,
					r.milestone_id,
					{ requestId: req.requestId },
				)
				await milestoneStore.updateReportStatus(id, "approved")
				try {
					await markEscrowActivity(r.scholar_address, r.course_id)
				} catch (trackingErr) {
					console.error("[admin] escrow activity update failed:", trackingErr)
				}
				await milestoneStore.addAuditEntry({
					report_id: id,
					validator_address: validatorAddress,
					decision: "approved",
					rejection_reason: null,
					contract_tx_hash: contractResult.txHash,
				})

				try {
					if (r.scholar_email) {
						await emailService.sendNotification({
							to: r.scholar_email,
							subject: "Milestone Approved ",
							template: "milestone-approved-admin",
							data: {
								name: r.scholar_name || "Scholar",
								courseTitle: r.course_title || `Course ${r.course_id}`,
								milestoneTitle:
									r.milestone_title ||
									`Milestone ${r.milestone_number ?? r.milestone_id}`,
								milestoneNumber: String(
									r.milestone_number ?? r.milestone_id,
								),
								reward: String(r.lrn_reward ?? 0),
								dashboardUrl: `${process.env.FRONTEND_URL || ""}/dashboard`,
								unsubscribeUrl: "#",
							},
						})
					}
				} catch (emailErr) {
					console.error(
						"[admin] approval email failed (non-blocking):",
						emailErr,
					)
				}

				try {
					await credentialService.mintCertificateIfComplete(
						r.scholar_address,
						r.course_id,
					)
				} catch (mintErr) {
					console.error(
						"[admin] Certificate mint failed (non-blocking):",
						mintErr,
					)
				}

				succeeded++
				results.push({ reportId: id, success: true, status: "approved" })
			} catch (err) {
				console.error("[admin] batchApproveMilestones item error:", err)
				results.push({ reportId: id, success: false, status: "error" })
			}
		}

		res.status(200).json({
			data: {
				succeeded,
				failed: results.length - succeeded,
				results,
			},
		})
	} catch (err) {
		console.error("[admin] batchApproveMilestones error:", err)
		res.status(500).json({ error: "Failed to batch approve milestones" })
	}
}

export async function batchRejectMilestones(
	req: AdminRequest,
	res: Response,
): Promise<void> {
	const { milestoneIds, reason: rawReason } = req.body as {
		milestoneIds: number[]
		reason?: string
	}
	const validatorAddress = req.adminAddress ?? "unknown"

	const reasonInput =
		typeof rawReason === "string" && rawReason.trim().length > 0
			? rawReason.trim()
			: "Batch rejection"
	if (reasonInput.length > 1000) {
		res.status(400).json({ error: "Rejection reason must be 1000 characters or fewer" })
		return
	}
	const sanitizedReason = sanitizeHtml(reasonInput, {
		allowedTags: [],
		allowedAttributes: {},
	})

	try {
		const loaded: Array<{ id: number; report: MilestoneReport | null }> = []
		for (const id of milestoneIds) {
			loaded.push({ id, report: await milestoneStore.getReportById(id) })
		}

		const missing = loaded.filter((x) => !x.report)
		if (missing.length > 0) {
			res.status(404).json({
				error: "One or more milestone reports were not found",
				data: {
					results: missing.map((m) => ({
						reportId: m.id,
						success: false,
						status: "not_found",
					})),
				},
			})
			return
		}

		const notPending = loaded.filter((x) => x.report!.status !== "pending")
		if (notPending.length > 0) {
			res.status(409).json({
				error: "All milestone reports must be pending before batch processing",
				data: {
					results: notPending.map((x) => ({
						reportId: x.id,
						success: false,
						status: x.report!.status,
					})),
				},
			})
			return
		}

		if (!hasStellarMilestoneCredentials()) {
			res.status(503).json({ error: "Stellar credentials not configured" })
			return
		}

		const results: BatchItemResult[] = []
		let succeeded = 0

		for (const { id, report } of loaded) {
			const r = report!
			try {
				const contractResult = await stellarContractService.emitRejectionEvent(
					r.scholar_address,
					r.course_id,
					r.milestone_id,
					sanitizedReason,
					{ requestId: req.requestId },
				)
				await milestoneStore.updateReportStatus(id, "rejected")
				try {
					await markEscrowActivity(r.scholar_address, r.course_id)
				} catch (trackingErr) {
					console.error("[admin] escrow activity update failed:", trackingErr)
				}
				await milestoneStore.addAuditEntry({
					report_id: id,
					validator_address: validatorAddress,
					decision: "rejected",
					rejection_reason: sanitizedReason,
					contract_tx_hash: contractResult.txHash,
				})

				try {
					if (r.scholar_email) {
						await emailService.sendNotification({
							to: r.scholar_email,
							subject: "Milestone Rejected",
							template: "milestone-rejected-admin",
							data: {
								name: r.scholar_name || "Scholar",
								courseTitle: r.course_title || `Course ${r.course_id}`,
								milestoneTitle:
									r.milestone_title ||
									`Milestone ${r.milestone_number ?? r.milestone_id}`,
								milestoneNumber: String(
									r.milestone_number ?? r.milestone_id,
								),
								rejectionReason: sanitizedReason,
								milestoneUrl: `${process.env.FRONTEND_URL || ""}/milestones`,
								unsubscribeUrl: "#",
							},
						})
					}
				} catch (emailErr) {
					console.error(
						"[admin] rejection email failed (non-blocking):",
						emailErr,
					)
				}

				succeeded++
				results.push({
					reportId: id,
					success: true,
					status: "rejected",
					reason: sanitizedReason,
				})
			} catch (err) {
				console.error("[admin] batchRejectMilestones item error:", err)
				results.push({ reportId: id, success: false, status: "error" })
			}
		}

		res.status(200).json({
			data: {
				succeeded,
				failed: results.length - succeeded,
				results,
			},
		})
	} catch (err) {
		console.error("[admin] batchRejectMilestones error:", err)
		res.status(500).json({ error: "Failed to batch reject milestones" })
	}
}

export async function batchApproveMilestones(
	req: AdminRequest,
	res: Response,
): Promise<void> {
	const { milestoneIds } = req.body as { milestoneIds: number[] }
	if (!Array.isArray(milestoneIds) || milestoneIds.length === 0) {
		res.status(400).json({ error: "No milestone report IDs provided" })
		return
	}

	const results = []
	let succeeded = 0
	let failed = 0

	// Pre-validation: ensure all reports exist and are pending
	for (const id of milestoneIds) {
		const report = await milestoneStore.getReportById(id)
		if (!report) {
			res.status(404).json({
				error: "One or more milestone reports were not found",
				data: { results: [{ reportId: id, success: false, status: "not_found" }] }
			})
			return
		}
		if (report.status !== "pending") {
			res.status(409).json({
				error: "All milestone reports must be pending before batch processing",
				data: { results: [{ reportId: id, success: false, status: report.status }] }
			})
			return
		}
	}

	for (const id of milestoneIds) {
		try {
			const report = (await milestoneStore.getReportById(id))!
			const contractResult = await stellarContractService.callVerifyMilestone(
				report.scholar_address,
				report.course_id,
				report.milestone_id,
				{ requestId: req.requestId },
			)
			await milestoneStore.updateReportStatus(id, "approved")
			await milestoneStore.addAuditEntry({
				report_id: id,
				validator_address: req.adminAddress ?? "unknown",
				decision: "approved",
				rejection_reason: null,
				contract_tx_hash: contractResult.txHash,
			})
			results.push({ reportId: id, success: true, status: "approved", txHash: contractResult.txHash })
			succeeded++
		} catch (err) {
			results.push({ reportId: id, success: false, status: "failed", error: err instanceof Error ? err.message : String(err) })
			failed++
		}
	}

	res.status(200).json({ data: { succeeded, failed, results } })
}

export async function batchRejectMilestones(
	req: AdminRequest,
	res: Response,
): Promise<void> {
	const { milestoneIds, reason } = req.body as { milestoneIds: number[]; reason: string }
	if (!Array.isArray(milestoneIds) || milestoneIds.length === 0) {
		res.status(400).json({ error: "No milestone report IDs provided" })
		return
	}

	const results = []
	let succeeded = 0
	let failed = 0

	// Pre-validation: ensure all reports exist and are pending
	for (const id of milestoneIds) {
		const report = await milestoneStore.getReportById(id)
		if (!report) {
			res.status(404).json({
				error: "One or more milestone reports were not found",
				data: { results: [{ reportId: id, success: false, status: "not_found" }] }
			})
			return
		}
		if (report.status !== "pending") {
			res.status(409).json({
				error: "All milestone reports must be pending before batch processing",
				data: { results: [{ reportId: id, success: false, status: report.status }] }
			})
			return
		}
	}

	for (const id of milestoneIds) {
		try {
			const report = (await milestoneStore.getReportById(id))!
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
				validator_address: req.adminAddress ?? "unknown",
				decision: "rejected",
				rejection_reason: reason,
				contract_tx_hash: contractResult.txHash,
			})
			results.push({ reportId: id, success: true, status: "rejected", txHash: contractResult.txHash, reason })
			succeeded++
		} catch (err) {
			results.push({ reportId: id, success: false, status: "failed", error: err instanceof Error ? err.message : String(err) })
			failed++
		}
	}

	res.status(200).json({ data: { succeeded, failed, results } })
}
