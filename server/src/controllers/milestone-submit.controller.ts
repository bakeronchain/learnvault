import { type Request, type Response } from "express"
import sanitizeHtml from "sanitize-html"
import { milestoneStore } from "../db/milestone-store"
import { createEmailService } from "../services/email.service"
import { markEscrowActivity } from "../services/escrow-timeout.service"

interface MilestoneSubmitRequestBody {
	scholarAddress?: string
	learner_address?: string
	courseId?: string
	course_id?: string
	milestoneId?: number
	milestone_id?: number
	evidenceGithub?: string
	evidenceIpfsCid?: string
	evidenceDescription?: string
	evidence_url?: string
}
const emailService = createEmailService(process.env.EMAIL_API_KEY || "")

export async function submitMilestoneReport(
	req: Request,
	res: Response,
): Promise<void> {
	const body = req.body as MilestoneSubmitRequestBody

	const scholarAddress = body.scholarAddress ?? body.learner_address
	const courseId = body.courseId ?? body.course_id
	const milestoneId = body.milestoneId ?? body.milestone_id
	const evidenceGithub = body.evidenceGithub ?? body.evidence_url
	const evidenceIpfsCid = body.evidenceIpfsCid
	let evidenceDescription = body.evidenceDescription

	// Validate required fields
	if (!scholarAddress || !courseId || milestoneId === undefined) {
		res.status(400).json({ error: "Invalid request body" })
		return
	}

	// Validate evidence description length
	if (evidenceDescription && evidenceDescription.length > 2000) {
		res.status(400).json({ error: "Evidence description must be 2000 characters or fewer" })
		return
	}

	// Sanitize evidence description
	if (evidenceDescription) {
		evidenceDescription = sanitizeHtml(evidenceDescription, {
			allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
			allowedAttributes: {},
		})
	}

	try {
		const report = await milestoneStore.createReport({
			scholar_address: scholarAddress,
			course_id: courseId,
			milestone_id: milestoneId,
			evidence_github: evidenceGithub ?? null,
			evidence_ipfs_cid: evidenceIpfsCid ?? null,
			evidence_description: evidenceDescription ?? null,
		})
		try {
			await markEscrowActivity(scholarAddress, courseId)
		} catch (trackingErr) {
			console.error("[milestones] escrow activity update failed:", trackingErr)
		}

		emailService
			.sendAdminMilestoneNotification(
				scholarAddress, // Using address as name since name wasn't in the body
				courseId,
				milestoneId.toString(),
			)
			.catch((err) => console.error("[EmailService] Admin alert failed:", err))
		res.status(201).json({ data: report })
	} catch (err) {
		if (err instanceof Error && err.message === "DUPLICATE_REPORT") {
			res.status(409).json({
				error: "A report for this milestone has already been submitted",
			})
			return
		}
		console.error("[milestones] submitMilestoneReport error:", err)
		res.status(500).json({ error: "Failed to submit milestone report" })
	}
}
