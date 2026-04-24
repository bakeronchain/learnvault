import { rpc } from "@stellar/stellar-sdk"
import { type Request, type Response } from "express"

const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? "testnet"
const SCHOLARSHIP_TREASURY_CONTRACT_ID =
	process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID ?? ""

function parsePositiveInt(value: unknown, fallback: number): number {
	if (typeof value !== "string") return fallback
	const parsed = Number.parseInt(value, 10)
	if (Number.isNaN(parsed) || parsed < 0) return fallback
	return parsed
}

/**
 * GET /api/treasury/stats
 * Returns aggregated treasury statistics
 */
export const getTreasuryStats = async (
	_req: Request,
	res: Response,
): Promise<void> => {
	if (!SCHOLARSHIP_TREASURY_CONTRACT_ID) {
		res.status(503).json({
			error: "Treasury contract not configured",
		})
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
			filters: [{ contractIds: [SCHOLARSHIP_TREASURY_CONTRACT_ID] }],
			startLedger: Number(process.env.STARTING_LEDGER || "460000000"),
			limit: 1000,
		})

		let totalDeposited = BigInt(0)
		let totalDisbursed = BigInt(0)
		const scholars = new Set<string>()
		const donors = new Set<string>()
		let activeProposals = 0

		// Parse events to calculate stats
		for (const event of response.events) {
			const { scValToNative } = await import("@stellar/stellar-sdk")
			const eventData = scValToNative(event.value)

			// Identify event type from topics
			const topics = event.topic.map((t: any) => scValToNative(t))
			const eventType = topics[0]

			if (eventType === "deposit" || eventType === "Deposit") {
				const amount = BigInt(eventData.amount || 0)
				totalDeposited += amount
				if (eventData.donor) donors.add(eventData.donor)
			} else if (eventType === "disburse" || eventType === "Disburse") {
				const amount = BigInt(eventData.amount || 0)
				totalDisbursed += amount
				if (eventData.scholar) scholars.add(eventData.scholar)
			} else if (eventType === "proposal_submitted") {
				activeProposals++
			}
		}

		res.status(200).json({
			total_deposited_usdc: totalDeposited.toString(),
			total_disbursed_usdc: totalDisbursed.toString(),
			scholars_funded: scholars.size,
			active_proposals: activeProposals,
			donors_count: donors.size,
		})
	} catch (err) {
		console.error("[treasury] Failed to fetch stats:", err)
		res.status(500).json({
			error: "Failed to fetch treasury statistics",
		})
	}
}

/**
 * GET /api/treasury/activity
 * Returns recent treasury activity (deposits and disbursements)
 */
export const getTreasuryActivity = async (
	req: Request,
	res: Response,
): Promise<void> => {
	if (!SCHOLARSHIP_TREASURY_CONTRACT_ID) {
		res.status(503).json({
			error: "Treasury contract not configured",
		})
		return
	}

	const limit = Math.max(
		1,
		Math.min(parsePositiveInt(req.query.limit, 20), 100),
	)
	const offset = Math.max(0, parsePositiveInt(req.query.offset, 0))

	try {
		const server = new rpc.Server(
			STELLAR_NETWORK === "mainnet"
				? "https://soroban-rpc.stellar.org"
				: "https://soroban-testnet.stellar.org",
		)

		// Fetch events from the ScholarshipTreasury contract
		const response = await server.getEvents({
			filters: [{ contractIds: [SCHOLARSHIP_TREASURY_CONTRACT_ID] }],
			startLedger: Number(process.env.STARTING_LEDGER || "460000000"),
			limit: 1000,
		})

		const events: Array<{
			type: string
			amount?: string
			address?: string
			scholar?: string
			tx_hash: string
			created_at: string
		}> = []

		// Parse and format events
		for (const event of response.events) {
			const { scValToNative } = await import("@stellar/stellar-sdk")
			const eventData = scValToNative(event.value)

			// Identify event type from topics
			const topics = event.topic.map((t: any) => scValToNative(t))
			const eventType = topics[0]

			if (eventType === "deposit" || eventType === "Deposit") {
				events.push({
					type: "deposit",
					amount: eventData.amount?.toString() || "0",
					address: eventData.donor || "unknown",
					tx_hash: event.txHash || "",
					created_at: event.ledgerClosedAt || new Date().toISOString(),
				})
			} else if (eventType === "disburse" || eventType === "Disburse") {
				events.push({
					type: "disburse",
					scholar: eventData.scholar || "unknown",
					amount: eventData.amount?.toString() || "0",
					tx_hash: event.txHash || "",
					created_at: event.ledgerClosedAt || new Date().toISOString(),
				})
			}
		}

		// Sort by created_at descending (most recent first)
		events.sort(
			(a, b) =>
				new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
		)

		// Apply pagination
		const paginatedEvents = events.slice(offset, offset + limit)

		res.status(200).json({
			events: paginatedEvents,
		})
	} catch (err) {
		console.error("[treasury] Failed to fetch activity:", err)
		res.status(500).json({
			error: "Failed to fetch treasury activity",
		})
	}
}
