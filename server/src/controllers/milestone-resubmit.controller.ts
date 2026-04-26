import { type Request, type Response } from "express"
import { milestoneStore } from "../db/milestone-store"

interface MilestoneResubmitRequestBody {
	id: number
	evidenceGithub?: string
	evidenceIpfsCid?: string
	evidenceDescription?: string
}

export async function resubmitMilestoneReport(
	req: Request,
	res: Response,
): Promise<void> {
	const body = req.body as MilestoneResubmitRequestBody

	const { id, evidenceGithub, evidenceIpfsCid, evidenceDescription } = body

	if (!id) {
		res.status(400).json({ error: "Milestone report ID is required" })
		return
	}

	try {
		// Get the existing report
		const existing = await milestoneStore.getReportById(id)
		if (!existing) {
			res.status(404).json({ error: "Milestone report not found" })
			return
		}

		if (existing.status !== "rejected") {
			res.status(400).json({ error: "Only rejected milestones can be resubmitted" })
			return
		}

		// Update the report
		const updated = await milestoneStore.createReport({
			scholar_address: existing.scholar_address,
			course_id: existing.course_id,
			milestone_id: existing.milestone_id,
			evidence_github: evidenceGithub ?? existing.evidence_github,
			evidence_ipfs_cid: evidenceIpfsCid ?? existing.evidence_ipfs_cid,
			evidence_description: evidenceDescription ?? existing.evidence_description,
		})

		res.status(200).json({ data: updated })
	} catch (err) {
		console.error("[milestones] resubmitMilestoneReport error:", err)
		res.status(500).json({ error: "Failed to resubmit milestone report" })
	}
}