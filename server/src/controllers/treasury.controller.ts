import { rpc } from "@stellar/stellar-sdk"
import { type Request, type Response } from "express"
import { logger } from "../lib/logger"

const log = logger.child({ module: "treasury" })

const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? "testnet"
const SCHOLARSHIP_TREASURY_CONTRACT_ID =
	process.env.SCHOLARSHIP_TREASURY_CONTRACT_ID ?? ""

// Known asset contract IDs → symbol/USD rate mapping.
// Rates are approximate fixed values for display normalization; a production
// deployment should use a price oracle.
const ASSET_SYMBOL_MAP: Record<string, { symbol: string; usdRate: number }> =
	buildAssetMap()

function buildAssetMap(): Record<string, { symbol: string; usdRate: number }> {
	const map: Record<string, { symbol: string; usdRate: number }> = {}

	const usdc = process.env.USDC_CONTRACT_ID
	if (usdc) map[usdc] = { symbol: "USDC", usdRate: 1.0 }

	const eurc = process.env.EURC_CONTRACT_ID
	if (eurc) map[eurc] = { symbol: "EURC", usdRate: 1.08 }

	const xlm = process.env.XLM_SAC_CONTRACT_ID
	if (xlm) map[xlm] = { symbol: "XLM", usdRate: 0.11 }

	return map
}

function symbolForAsset(assetAddress: string | undefined): string {
	if (!assetAddress) return "USDC"
	return ASSET_SYMBOL_MAP[assetAddress]?.symbol ?? assetAddress.slice(0, 8)
}

function usdRateForAsset(assetAddress: string | undefined): number {
	if (!assetAddress) return 1.0
	return ASSET_SYMBOL_MAP[assetAddress]?.usdRate ?? 1.0
}

function parsePositiveInt(value: unknown, fallback: number): number {
	if (typeof value !== "string") return fallback
	const parsed = Number.parseInt(value, 10)
	if (Number.isNaN(parsed) || parsed < 0) return fallback
	return parsed
}

const STROOPS = 10_000_000

/**
 * GET /api/treasury/stats
 * Returns aggregated treasury statistics including per-asset breakdown.
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

		const response = await server.getEvents({
			filters: [{ contractIds: [SCHOLARSHIP_TREASURY_CONTRACT_ID] }],
			startLedger: parseInt(process.env.STARTING_LEDGER || "460000000", 10),
			limit: 1000,
		})

		let totalDeposited = BigInt(0)
		let totalDisbursed = BigInt(0)
		const scholars = new Set<string>()
		const donors = new Set<string>()
		let activeProposals = 0

		// Per-asset totals: assetAddress → atomic units deposited
		const assetTotals = new Map<string, bigint>()

		const { scValToNative } = await import("@stellar/stellar-sdk")

		for (const event of response.events) {
			const eventData = scValToNative(event.value)
			const topics = event.topic.map((t: unknown) => scValToNative(t))
			const eventType = topics[0]

			if (eventType === "deposit" || eventType === "Deposit") {
				const amount = BigInt(eventData.amount ?? 0)
				const assetAddress: string | undefined =
					typeof eventData.asset === "string" ? eventData.asset : undefined

				totalDeposited += amount

				const key = assetAddress ?? "__usdc__"
				assetTotals.set(key, (assetTotals.get(key) ?? BigInt(0)) + amount)

				if (eventData.donor) donors.add(eventData.donor as string)
			} else if (eventType === "disburse" || eventType === "Disburse") {
				const amount = BigInt(eventData.amount ?? 0)
				totalDisbursed += amount
				if (eventData.scholar) scholars.add(eventData.scholar as string)
			} else if (eventType === "proposal_submitted") {
				activeProposals++
			}
		}

		// Build per-asset breakdown
		const asset_balances = Array.from(assetTotals.entries()).map(
			([assetAddress, atomicUnits]) => {
				const isLegacy = assetAddress === "__usdc__"
				const resolvedAddress = isLegacy
					? (process.env.USDC_CONTRACT_ID ?? "")
					: assetAddress
				const symbol = isLegacy ? "USDC" : symbolForAsset(assetAddress)
				const rate = isLegacy ? 1.0 : usdRateForAsset(assetAddress)
				const usdEquivalent = (
					(Number(atomicUnits) / STROOPS) *
					rate
				).toFixed(2)

				return {
					asset: resolvedAddress,
					symbol,
					deposited: atomicUnits.toString(),
					usd_equivalent: usdEquivalent,
				}
			},
		)

		res.status(200).json({
			total_deposited_usdc: totalDeposited.toString(),
			total_disbursed_usdc: totalDisbursed.toString(),
			scholars_funded: scholars.size,
			active_proposals: activeProposals,
			donors_count: donors.size,
			asset_balances,
		})
	} catch (err) {
		log.error({ err }, "Failed to fetch stats")
		res.status(500).json({
			error: "Failed to fetch treasury statistics",
		})
	}
}

/**
 * GET /api/treasury/activity
 * Returns recent treasury activity (deposits and disbursements) with asset info.
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
	const pageParam = parsePositiveInt(req.query.page, 1)
	const offsetParam = parsePositiveInt(req.query.offset, -1)
	const offset = offsetParam >= 0 ? offsetParam : (pageParam - 1) * limit
	const page = offsetParam >= 0 ? Math.floor(offset / limit) + 1 : pageParam

	try {
		const server = new rpc.Server(
			STELLAR_NETWORK === "mainnet"
				? "https://soroban-rpc.stellar.org"
				: "https://soroban-testnet.stellar.org",
		)

		const response = await server.getEvents({
			filters: [{ contractIds: [SCHOLARSHIP_TREASURY_CONTRACT_ID] }],
			startLedger: parseInt(process.env.STARTING_LEDGER || "460000000", 10),
			limit: 1000,
		})

		const events: Array<{
			type: string
			amount?: string
			asset?: string
			asset_symbol?: string
			address?: string
			scholar?: string
			tx_hash: string
			created_at: string
		}> = []

		const { scValToNative } = await import("@stellar/stellar-sdk")

		for (const event of response.events) {
			const eventData = scValToNative(event.value)
			const topics = event.topic.map((t: unknown) => scValToNative(t))
			const eventType = topics[0]

			if (eventType === "deposit" || eventType === "Deposit") {
				const assetAddress: string | undefined =
					typeof eventData.asset === "string" ? eventData.asset : undefined

				events.push({
					type: "deposit",
					amount: eventData.amount?.toString() ?? "0",
					asset: assetAddress,
					asset_symbol: symbolForAsset(assetAddress),
					address: (eventData.donor as string | undefined) ?? "unknown",
					tx_hash: event.txHash ?? "",
					created_at: event.ledgerClosedAt ?? new Date().toISOString(),
				})
			} else if (eventType === "disburse" || eventType === "Disburse") {
				events.push({
					type: "disburse",
					scholar: (eventData.scholar as string | undefined) ?? "unknown",
					amount: eventData.amount?.toString() ?? "0",
					tx_hash: event.txHash ?? "",
					created_at: event.ledgerClosedAt ?? new Date().toISOString(),
				})
			}
		}

		events.sort(
			(a, b) =>
				new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
		)

		const paginatedEvents = events.slice(offset, offset + limit)
		const total = events.length

		res.status(200).json({
			data: paginatedEvents,
			pagination: { page, limit, total },
		})
	} catch (err) {
		log.error({ err }, "Failed to fetch activity")
		res.status(500).json({
			error: "Failed to fetch treasury activity",
		})
	}
}
