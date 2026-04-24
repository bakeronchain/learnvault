import { type Request, type Response } from "express"
import { z } from "zod"

import { pool } from "../db/index"
import { trackEscrowTimeout } from "../services/escrow-timeout.service"
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

	const {
		applicant_address,
		full_name,
		course_id,
		motivation,
		evidence_url,
		amount,
	} = validation.data

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
		const result = await stellarContractService.submitScholarshipProposal(
			params,
			{ requestId: req.requestId },
		)

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
		if (proposal_id) {
			try {
				await trackEscrowTimeout({
					proposalId: proposal_id,
					scholarAddress: applicant_address,
					courseId: course_id,
				})
			} catch (trackingErr) {
				console.error("[scholarships] escrow tracking failed:", trackingErr)
			}
		}

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

/**
 * GET /api/scholarships/metrics
 * Returns aggregated health metrics for the scholarship program.
 */
export async function getScholarshipMetrics(
	_req: Request,
	res: Response,
): Promise<void> {
	try {
		const result = await pool.query(`
			WITH scholar_stats AS (
				SELECT
					scholar_address,
					COUNT(*) FILTER (WHERE status = 'approved') AS completed_milestones,
					COUNT(*) FILTER (WHERE status IN ('pending', 'approved', 'rejected')) AS total_milestones
				FROM milestone_reports
				GROUP BY scholar_address
			),
			proposal_stats AS (
				SELECT
					COUNT(*) FILTER (WHERE status = 'pending' OR status = 'approved') AS active_scholarships,
					COUNT(*) FILTER (WHERE status = 'rejected') AS dropped,
					COUNT(*) AS total_proposals,
					COALESCE(SUM(CASE WHEN status IN ('approved', 'completed') THEN amount ELSE 0 END), 0) AS total_disbursed_usdc
				FROM proposals
			)
			SELECT
				ps.active_scholarships,
				ps.dropped,
				ps.total_proposals,
				ps.total_disbursed_usdc,
				COUNT(ss.scholar_address) AS total_scholars,
				CASE
					WHEN COUNT(ss.scholar_address) = 0 THEN 0
					ELSE ROUND(
						100.0 * COUNT(ss.scholar_address) FILTER (WHERE ss.completed_milestones >= 3) /
						NULLIF(COUNT(ss.scholar_address), 0), 1
					)
				END AS completion_rate,
				CASE
					WHEN COUNT(ss.scholar_address) = 0 THEN 0
					ELSE ROUND(AVG(ss.completed_milestones), 1)
				END AS avg_milestones_per_scholar,
				CASE
					WHEN ps.total_proposals = 0 THEN 0
					ELSE ROUND(100.0 * ps.dropped / NULLIF(ps.total_proposals, 0), 1)
				END AS dropout_rate
			FROM proposal_stats ps
			LEFT JOIN scholar_stats ss ON true
			GROUP BY ps.active_scholarships, ps.dropped, ps.total_proposals, ps.total_disbursed_usdc
		`)

		const row = result.rows[0] ?? {}

		res.status(200).json({
			active_scholarships: Number(row.active_scholarships ?? 0),
			total_scholars: Number(row.total_scholars ?? 0),
			completion_rate: Number(row.completion_rate ?? 0),
			avg_milestones_per_scholar: Number(row.avg_milestones_per_scholar ?? 0),
			dropout_rate: Number(row.dropout_rate ?? 0),
			total_usdc_disbursed: Number(row.total_disbursed_usdc ?? 0),
		})
	} catch (err) {
		console.error("[scholarships] getScholarshipMetrics error:", err)
		res.status(500).json({ error: "Failed to fetch scholarship metrics" })
	}
}

export async function contributeToScholarship(
    req: Request,
    res: Response,
): Promise<void> {
    const contributionSchema = z.object({
        proposal_id: z.number(),
        donor_address: z.string().min(50).max(56),
        amount: z.number().positive(),
        tx_hash: z.string().min(64),
    })

    const validation = contributionSchema.safeParse(req.body)
    if (!validation.success) {
        res.status(400).json({ error: "Invalid contribution data" })
        return
    }

    const { proposal_id, donor_address, amount, tx_hash } = validation.data

    try {
        const client = await pool.connect()
        try {
            await client.query("BEGIN")
            
            // 1. Record the contribution
            await client.query(
                "INSERT INTO scholarship_contributions (proposal_id, donor_address, amount, tx_hash) VALUES (, , , )",
                [proposal_id, donor_address, amount, tx_hash]
            )

            // 2. Update the proposal's current funding
            const updateResult = await client.query(
                "UPDATE proposals SET current_funding = current_funding +  WHERE id =  RETURNING current_funding, amount",
                [amount, proposal_id]
            )

            const { current_funding, amount: target_amount } = updateResult.rows[0]

            // 3. Check if fully funded
            if (parseFloat(current_funding) >= parseFloat(target_amount)) {
                await client.query("UPDATE proposals SET status = 'funded' WHERE id = ", [proposal_id])
            }

            await client.query("COMMIT")
            res.status(200).json({ message: "Contribution recorded successfully", current_funding })
        } catch (err) {
            await client.query("ROLLBACK")
            throw err
        } finally {
            client.release()
        }
    } catch (err) {
        console.error("[scholarships] Contribution failed:", err)
        res.status(500).json({ error: "Internal server error" })
    }
}
