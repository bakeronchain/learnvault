import { rpc } from "@stellar/stellar-sdk"
import { type Request, type Response } from "express"
import NodeCache from "node-cache"
import { milestoneStore } from "../db/milestone-store"

const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? "testnet"
const SCHOLARSHIP_TREASURY_CONTRACT_ID =
	process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID ?? ""

// Cache for donor impact data with 5-minute TTL
const donorImpactCache = new NodeCache({ stdTTL: 300 }) // 5 minutes

/**
 * GET /api/donors/:address/impact
 * Returns impact metrics for a specific donor
 */
export const getDonorImpact = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const { address } = req.params

	if (!address || typeof address !== "string") {
		res.status(400).json({
			error: "Invalid donor address",
		})
		return
	}

	if (!SCHOLARSHIP_TREASURY_CONTRACT_ID) {
		res.status(503).json({
			error: "Treasury contract not configured",
		})
		return
	}

	// Check cache first
	const cacheKey = `donor_impact_${address}`
	const cachedImpact = donorImpactCache.get(cacheKey)
	if (cachedImpact) {
		res.status(200).json(cachedImpact)
		return
	}

	try {
		const server = new rpc.Server(
			STELLAR_NETWORK === "mainnet"
				? "https://soroban-rpc.stellar.org"
				: "https://soroban-testnet.stellar.org",
		)

		// Fetch events from the ScholarshipTreasury contract
		const response = await server.getEvents({
			filters: [{ contract: SCHOLARSHIP_TREASURY_CONTRACT_ID }],
			startLedger: process.env.STARTING_LEDGER || "460000000",
			pagination: { maxPageSize: 1000 },
		})

		let totalDonated = BigInt(0)
		const fundedScholars = new Set<string>()
		const scholarToMilestones = new Map<string, { completed: number; total: number }>()

		// Parse events to calculate donor-specific impact
		for (const page of response.events) {
			for (const event of page) {
				const { scValToNative } = await import("@stellar/stellar-sdk")
				const eventData = scValToNative(event.value)

				// Identify event type from topics
				const topics = event.topic.map((t: any) => scValToNative(t))
				const eventType = topics[0]

				if (eventType === "deposit" || eventType === "Deposit") {
					const donor = eventData.donor
					if (donor && donor.toLowerCase() === address.toLowerCase()) {
						const amount = BigInt(eventData.amount || 0)
						totalDonated += amount
					}
				} else if (eventType === "disburse" || eventType === "Disburse") {
					const scholar = eventData.scholar
					if (scholar) {
						fundedScholars.add(scholar)
						// Initialize milestone tracking for this scholar if not already done
						if (!scholarToMilestones.has(scholar)) {
							scholarToMilestones.set(scholar, { completed: 0, total: 0 })
						}
					}
				}
			}
		}

		// If this donor hasn't funded any scholars, return early with zero impact
		if (fundedScholars.size === 0) {
			const impactData = {
				total_donated_usdc: totalDonated.toString(),
				scholars_funded: 0,
				milestones_completed: 0,
				average_completion_rate: 0,
			}
			
			// Cache the result
			donorImpactCache.set(cacheKey, impactData)
			
			res.status(200).json(impactData)
			return
		}

		// Fetch milestone data for funded scholars
		let totalMilestonesCompleted = 0
		let totalMilestones = 0

		for (const scholarAddress of fundedScholars) {
			// Fetch scholar's milestone data from the database
			const scholarMilestoneData = await fetchScholarMilestones(scholarAddress)
			
			totalMilestonesCompleted += scholarMilestoneData.completed
			totalMilestones += scholarMilestoneData.total
		}

		// Calculate average completion rate
		const averageCompletionRate = totalMilestones > 0 
			? totalMilestonesCompleted / totalMilestones 
			: 0

		const impactData = {
			total_donated_usdc: totalDonated.toString(),
			scholars_funded: fundedScholars.size,
			milestones_completed: totalMilestonesCompleted,
			average_completion_rate: averageCompletionRate,
		}

		// Cache the result
		donorImpactCache.set(cacheKey, impactData)

		res.status(200).json(impactData)
	} catch (err) {
		console.error("[donors] Failed to fetch donor impact:", err)
		res.status(500).json({
			error: "Failed to fetch donor impact statistics",
		})
	}
}

/**
 * Helper function to fetch milestone data for a scholar
 */
async function fetchScholarMilestones(
	scholarAddress: string
): Promise<{ completed: number; total: number }> {
	try {
		// Fetch all milestone reports for this scholar
		const reports = await milestoneStore.getReportsForScholar(scholarAddress, {})
		
		// Count completed vs total milestones
		let completed = 0
		const total = reports.length
		
		for (const report of reports) {
			if (report.status === 'approved') {
				completed++
			}
		}
		
		return { completed, total }
	} catch (error) {
		console.error(`[donors] Failed to fetch milestones for scholar ${scholarAddress}:`, error)
		// Return zero values if we can't fetch milestone data
		return { completed: 0, total: 0 }
	}
}
