import { type Response } from "express"
import sanitizeHtml from "sanitize-html"
import {
	getPeerReviewQueue,
	submitPeerReview,
} from "../db/peer-review-store"
import { type AuthRequest } from "../middleware/auth.middleware"

export async function getPeerReviewQueueHandler(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const address = req.user?.address
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	try {
		const queue = await getPeerReviewQueue(address)
		res.status(200).json({ data: queue })
	} catch (err) {
		console.error("[peer-review] queue error:", err)
		res.status(500).json({ error: "Failed to load peer review queue" })
	}
}

export async function submitPeerReviewHandler(
	req: AuthRequest,
	res: Response,
): Promise<void> {
	const address = req.user?.address
	if (!address) {
		res.status(401).json({ error: "Unauthorized" })
		return
	}

	const id = Number.parseInt(req.params.id ?? "", 10)
	if (!Number.isInteger(id) || id <= 0) {
		res.status(400).json({ error: "Invalid milestone report id" })
		return
	}

	const rawComment = req.body?.comment
	const comment =
		typeof rawComment === "string"
			? sanitizeHtml(rawComment, { allowedTags: [], allowedAttributes: {} })
					.trim() || null
			: null

	const verdict = req.body?.verdict as "approve" | "reject"

	try {
		const result = await submitPeerReview({
			reviewerAddress: address,
			reportId: id,
			verdict,
			comment,
		})

		if (!result.ok) {
			const statusByCode: Record<typeof result.code, number> = {
				NOT_FOUND: 404,
				NOT_PENDING: 409,
				SELF_REVIEW: 403,
				SAME_COURSE: 403,
				ALREADY_REVIEWED: 409,
				INSUFFICIENT_REPUTATION: 403,
			}
			const messages: Record<typeof result.code, string> = {
				NOT_FOUND: "Milestone report not found",
				NOT_PENDING: "This report is no longer pending review",
				SELF_REVIEW: "You cannot peer-review your own milestone submission",
				SAME_COURSE:
					"You cannot peer-review milestones for a course you are enrolled in",
				ALREADY_REVIEWED: "You have already submitted a peer review for this report",
				INSUFFICIENT_REPUTATION:
					"Peer review requires a higher LRN balance (reputation) threshold",
			}
			res.status(statusByCode[result.code]).json({
				error: messages[result.code],
				code: result.code,
			})
			return
		}

		res.status(201).json({
			data: {
				report_id: id,
				verdict,
				lrn_awarded: result.lrn_awarded,
			},
		})
	} catch (err) {
		console.error("[peer-review] submit error:", err)
		res.status(500).json({ error: "Failed to submit peer review" })
	}
}
