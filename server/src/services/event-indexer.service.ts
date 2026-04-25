import { rpc as StellarRpc } from "@stellar/stellar-sdk"
import { Pool } from "pg"
import {
	SOROBAN_RPC_URL,
	INDEXER_CONFIG,
	getPollingTargets,
} from "../lib/event-config"

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })

const rpc = new StellarRpc.Server(SOROBAN_RPC_URL)

export interface IndexedEvent {
	contract: string
	event_type: string
	data: Record<string, unknown>
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

					// Check idempotency
					const exists = await pool.query(
						"SELECT 1 FROM events WHERE contract = $1 AND ledger_sequence = $2",
						[contractId, ledger],
					)
					if ((exists.rowCount ?? 0) > 0) continue

					const data = { id: ev.id, type: ev.type, ledger: ev.ledger }

					await pool.query(
						`INSERT INTO events (contract, event_type, data, ledger_sequence)
             VALUES ($1, $2, $3, $4)`,
						[contractId, topic, data, ledger],
					)
					inserted++
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
	return (res.rows[0]?.max as number) || INDEXER_CONFIG.startingLedger
}
