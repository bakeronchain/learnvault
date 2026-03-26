import { type Request, type Response } from "express"
import { z } from "zod"

import { pool } from "../db/index"
import { stellarContractService } from "../services/stellar-contract.service"

const applySchema = z.object({
	applicant_address: z.string().min(50).max(56),
	full_name: z.string().min(2),
	course_id: z.string().min(2),
	motivation: z.string().min(10),
	evidence_url: z.string().url(),
	amount: z.number().positive().optional(),
})

export async function applyForScholarship(
	req: Request,
	res: Response,
): Promise<void> {
	const validation = applySchema.safeParse(req.body)
	if (!validation.success) {
		res.status(400).json({
			error: "Invalid application data",
			details: validation.error.flatten().fieldErrors,
		})
		return
	}

	const { applicant_address, full_name, course_id, motivation, evidence_url, amount } =
		validation.data

	try {
		// 1. Prepare contract parameters
		// Mapping simplified backend request to detailed on-chain proposal
		const today = new Date()
		const tomorrow = new Date(today)
		tomorrow.setDate(tomorrow.getDate() + 1)
		
		const month1 = new Date(today)
		month1.setMonth(month1.getMonth() + 1)
		
		const month2 = new Date(today)
		month2.setMonth(month2.getMonth() + 2)
		
		const month3 = new Date(today)
		month3.setMonth(month3.getMonth() + 3)

		const requestedAmount = amount || 1000 // Default 1000 USDC
		const atomicAmount = requestedAmount * 10 ** 7 // USDC has 7 decimals on Stellar

		const params = {
			applicant: applicant_address,
			amount: atomicAmount,
			programName: `${full_name} - ${course_id}`,
			programUrl: evidence_url,
			programDescription: motivation,
			startDate: tomorrow.toISOString().split("T")[0],
			milestoneTitles: [
				"Phase 1: Course Onboarding & Initial Progress",
				"Phase 2: Core Curriculum Completion",
				"Phase 3: Final Project Submission & Certification",
			],
			milestoneDates: [
				month1.toISOString().split("T")[0],
				month2.toISOString().split("T")[0],
				month3.toISOString().split("T")[0],
			],
		}

		// 2. Call the on-chain contract
		const result = await stellarContractService.submitScholarshipProposal(params)

		// 3. Store in the database
		const dbResult = await pool.query(
			`INSERT INTO proposals (
				author_address, 
				title, 
				description, 
				amount, 
				status,
				created_at
			) VALUES ($1, $2, $3, $4, 'pending', NOW())
			RETURNING id`,
			[
				applicant_address,
				`${full_name} - ${course_id}`,
				`Motivation: ${motivation}\n\nEvidence: ${evidence_url}`,
				requestedAmount,
			],
		)

		const proposal_id = dbResult.rows[0]?.id

		res.status(201).json({
			proposal_id,
			tx_hash: result.txHash,
			simulated: result.simulated,
		})
	} catch (err) {
		console.error("[scholarships] Application failed:", err)
		res.status(500).json({
			error: "Failed to submit scholarship application",
			message: err instanceof Error ? err.message : String(err),
		})
	}
}
