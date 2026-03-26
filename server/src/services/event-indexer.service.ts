import { Server } from "@stellar/stellar-sdk"
import { type GetEventsRequest } from "@stellar/stellar-sdk/lib/rpc"
import { Pool } from "pg"
import {
	SOROBAN_RPC_URL,
	INDEXER_CONFIG,
	getPollingTargets,
} from "../lib/event-config.js"
import { EVENT_TOPICS } from "../types/events.js"

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })

const rpc = new Server(SOROBAN_RPC_URL)

export interface IndexedEvent {
	contract: string
	event_type: string
	data: Record<string, any>
	ledger_sequence: string // RPC returns string, DB bigint
}

/**
 * Poll and index new events from target contracts
 * @param startLedger - Starting ledger (config or last indexed)
 * @param endLedger - Latest ledger to check
 */
export async function indexEventsBatch(
	startLedger: number,
	endLedger: number,
): Promise<void> {
	const targets = getPollingTargets()
	let inserted = 0

	for (const { contractId, topics } of targets) {
		for (const topic of topics) {
			const filters: GetEventsRequest["filters"] = [
				{ contract: contractId },
				{ type: "topic", value: topic },
			]

			try {
				const response = await rpc.getEvents({
					filters,
					startLedger: startLedger.toString(),
					pagination: { maxPageSize: 200 },
				})

				for (const page of response.events) {
					for (const ev of page) {
						const ledger = Number(ev.ledger)
						if (ledger > endLedger) continue // future?

						// Check idempotency
						const exists = await pool.query(
							"SELECT 1 FROM events WHERE contract = $1 AND ledger_sequence = $2",
							[contractId, ledger],
						)
						if (exists.rowCount > 0) continue

						// Parse data
						const data = ev.xdr.toObject() // or ev.topic + ev.value parsing
						// TODO: Use EVENT_DATA_SCHEMAS for validation/normalization

						await pool.query(
							`INSERT INTO events (contract, event_type, data, ledger_sequence)
               VALUES ($1, $2, $3, $4)`,
							[contractId, topic, data, ledger],
						)
						inserted++
					}
				}
			} catch (err) {
				console.error(`[indexer:${contractId}:${topic}] Error:`, err)
			}
		}
	}

	console.log(
		`[indexer] Inserted ${inserted} events from ${startLedger}-${endLedger}`,
	)
}

// Get last indexed ledger per contract (for resuming)
export async function getLastIndexedLedger(contract: string): Promise<number> {
	const res = await pool.query(
		"SELECT MAX(ledger_sequence) FROM events WHERE contract = $1",
		[contract],
	)
	return res.rows[0]?.max || INDEXER_CONFIG.startingLedger
}
