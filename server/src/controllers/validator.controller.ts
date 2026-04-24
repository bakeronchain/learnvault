import { type Request, type Response } from "express"
import { milestoneStore } from "../db/milestone-store"

interface ValidationRequestBody {
	report_id?: number
	scholar_address?: string
	course_id?: string
	milestone_id?: number
	evidence_url?: string
	evidence_description?: string
}

export const validateMilestone = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const body = req.body as ValidationRequestBody

	const errors: string[] = []

	// 1. Check required fields
	if (!body.report_id && !body.milestone_id) {
		errors.push("Either report_id or milestone_id is required")
	}
	if (!body.scholar_address) {
		errors.push("scholar_address is required")
	}
	if (!body.evidence_url && !body.evidence_description) {
		errors.push(
			"At least one evidence field is required (evidence_url or evidence_description)",
		)
	}

	if (errors.length > 0) {
		res.status(400).json({
			data: {
				approved: false,
				validator: "learnvault-validator",
				reasons: errors,
			},
		})
		return
	}

	// 2. If report_id is provided, verify the report exists and is pending
	if (body.report_id) {
		try {
			const report = await milestoneStore.getReportById(body.report_id)
			if (!report) {
				res.status(404).json({
					data: {
						approved: false,
						validator: "learnvault-validator",
						reasons: [`Report ${body.report_id} not found`],
					},
				})
				return
			}
			if (report.status !== "pending") {
				res.status(409).json({
					data: {
						approved: false,
						validator: "learnvault-validator",
						reasons: [`Report ${body.report_id} is already ${report.status}`],
					},
				})
				return
			}
		} catch {
			// Database unavailable — log and continue with field validation only
			console.warn(
				"[validator] Could not query milestone store, proceeding with field validation only",
			)
		}
	}

	// 3. All checks passed
	res.status(200).json({
		data: {
			approved: true,
			validator: "learnvault-validator",
			data: req.body,
		},
	})
}
