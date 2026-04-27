import { rpc as StellarRpc } from "@stellar/stellar-sdk"
import { Pool } from "pg"
import {
	SOROBAN_RPC_URL,
	INDEXER_CONFIG,
	getPollingTargets,
} from "../lib/event-config"
import { leaderboardEmitter } from "../lib/leaderboard-emitter"

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })

const rpc = new StellarRpc.Server(SOROBAN_RPC_URL)

export interface IndexedEvent {
	contract: string
	event_type: string
	data: Record<string, unknown>
	ledger_sequence: string // RPC returns string, DB bigint
	tx_hash?: string
	event_index?: number
}

/**
 * Extract transaction hash from event ID or data
 * Event ID format: "<ledger_sequence>-<tx_hash>-<event_index>"
 */
function extractTxHash(eventId: string): string | undefined {
	// Event IDs are typically formatted as: "0000428575-250fd482f34ac0d5387a77e62ae696126f22cb09377b8038cd1cf011c62dcbd-0"
	const parts = eventId.split("-")
	if (parts.length >= 2) {
		return parts[1]
	}
	return undefined
}

/**
 * Extract event index from event ID
 */
function extractEventIndex(eventId: string): number | undefined {
	const parts = eventId.split("-")
	if (parts.length >= 3) {
		const index = Number.parseInt(parts[2], 10)
		if (!Number.isNaN(index)) {
			return index
		}
	}
	return undefined
}

/**
 * Poll and index new events from target contracts using UPSERT for idempotency
 * @param startLedger - Starting ledger (config or last indexed)
 * @param endLedger - Latest ledger to check
 */
export async function indexEventsBatch(
	startLedger: number,
	endLedger: number,
): Promise<void> {
	const targets = getPollingTargets()
	let inserted = 0
	let skipped = 0

	for (const { contractId, topics } of targets) {
		// Track max ledger for this contract
		let maxLedgerForContract = startLedger

		for (const topic of topics) {
			const filters: StellarRpc.Api.EventFilter[] = [
				{
					type: "contract",
					contractIds: [contractId],
					topics: [[topic]],
				},
			]

			try {
				const response = await rpc.getEvents({
					filters,
					startLedger,
					endLedger,
					limit: 200,
				})

				for (const ev of response.events) {
					const ledger = Number(ev.ledger)
					if (ledger > endLedger) continue

					// Update max ledger for this contract
					if (ledger > maxLedgerForContract) {
						maxLedgerForContract = ledger
					}

					// Extract tx_hash and event_index from event ID
					const txHash = extractTxHash(ev.id)
					const eventIndex = extractEventIndex(ev.id)

					const data = {
						id: ev.id,
						type: ev.type,
						ledger: ev.ledger,
						topic: ev.topic,
						value: ev.value,
					}

					// Use UPSERT for idempotency
					// If the event already exists (same ledger, tx_hash, event_index), do nothing
					const result = await pool.query(
						`INSERT INTO events (contract, event_type, data, ledger_sequence, tx_hash, event_index)
						 VALUES ($1, $2, $3, $4, $5, $6)
						 ON CONFLICT (ledger_sequence, tx_hash, event_index) DO NOTHING
						 RETURNING id`,
						[contractId, topic, data, ledger, txHash, eventIndex],
					)

					if ((result.rowCount ?? 0) > 0) {
						inserted++

						// Notify leaderboard of potential balance changes
						if (topic === "LearnToken_Mint" || topic === "ScholarNFT::minted") {
							leaderboardEmitter.emitUpdate()
						}
					} else {
						skipped++
					}
				}
			} catch (err) {
				console.error(`[indexer:${contractId}:${topic}] Error:`, err)
			}
		}

		// Update indexer state with last processed ledger for this contract
		await updateIndexerState(contractId, maxLedgerForContract)
	}

	console.log(
		`[indexer] Inserted ${inserted}, skipped ${skipped} events from ${startLedger}-${endLedger}`,
	)
}

/**
 * Update indexer state with last processed ledger for a contract
 */
export async function updateIndexerState(
	contract: string,
	lastLedger: number,
): Promise<void> {
	await pool.query(
		`INSERT INTO indexer_state (contract, last_processed_ledger, last_processed_at)
		 VALUES ($1, $2, CURRENT_TIMESTAMP)
		 ON CONFLICT (contract) DO UPDATE SET
			 last_processed_ledger = EXCLUDED.last_processed_ledger,
			 last_processed_at = EXCLUDED.last_processed_at,
			 updated_at = CURRENT_TIMESTAMP`,
		[contract, lastLedger],
	)
}

/**
 * Get last indexed ledger per contract from indexer_state table
 * Falls back to events table max if no state exists
 */
export async function getLastIndexedLedger(contract: string): Promise<number> {
	// First check indexer_state table
	const stateRes = await pool.query(
		"SELECT last_processed_ledger FROM indexer_state WHERE contract = $1",
		[contract],
	)

	if (stateRes.rows.length > 0 && stateRes.rows[0].last_processed_ledger > 0) {
		return Number(stateRes.rows[0].last_processed_ledger)
	}

	// Fallback to events table for backward compatibility
	const eventsRes = await pool.query(
		"SELECT MAX(ledger_sequence) FROM events WHERE contract = $1",
		[contract],
	)

	return (eventsRes.rows[0]?.max as number) || INDEXER_CONFIG.startingLedger
}

/**
 * Get all indexer state entries
 */
export async function getAllIndexerState(): Promise<
	Array<{
		contract: string
		last_processed_ledger: number
		last_processed_at: Date
		updated_at: Date
	}>
> {
	const result = await pool.query(
		"SELECT contract, last_processed_ledger, last_processed_at, updated_at FROM indexer_state ORDER BY contract",
	)
	return result.rows
}
