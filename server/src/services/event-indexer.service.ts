import { rpc as StellarRpc } from "@stellar/stellar-sdk"
import { Pool } from "pg"
import {
	SOROBAN_RPC_URL,
	INDEXER_CONFIG,
	getPollingTargets,
} from "../lib/event-config"
import { getRpcCache, CacheKey } from "../lib/rpc-cache"

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })

const rpc = new StellarRpc.Server(SOROBAN_RPC_URL)

export interface IndexedEvent {
	contract: string
	event_type: string
	data: Record<string, unknown>
	ledger_sequence: string // RPC returns string, DB bigint
}

/**
 * Invalidate RPC cache entries that are stale after a new event is indexed.
 * We only invalidate keys we can derive from the event data — everything else
 * expires naturally via TTL.
 */
async function invalidateCacheForEvent(
	topic: string,
	data: Record<string, unknown>,
): Promise<void> {
	const cache = getRpcCache()
	const addr = typeof data.address === "string" ? data.address : null

	switch (topic) {
		case "LearnToken_Mint":
			if (addr) {
				await cache.invalidate(CacheKey.learnBalance(addr))
				await cache.invalidate(CacheKey.votingPower(addr))
			}
			break
		case "CourseMilestone_MilestoneComplete":
			if (addr) {
				const courseId =
					typeof data.courseId === "string" ? Number(data.courseId) : null
				if (courseId !== null && !isNaN(courseId)) {
					await cache.invalidate(CacheKey.enrollment(addr, courseId))
				}
			}
			break
		case "ScholarshipTreasury_Deposit":
			// Deposit mints governance tokens — invalidate gov balance + voting power
			if (addr) {
				await cache.invalidate(CacheKey.govBalance(addr))
				await cache.invalidate(CacheKey.votingPower(addr))
			}
			break
		case "ScholarshipTreasury_VoteCastEvent": {
			const voter =
				typeof data.voter === "string" ? data.voter : null
			if (voter) {
				await cache.invalidate(CacheKey.votingPower(voter))
			}
			break
		}
		default:
			break
	}
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
					await invalidateCacheForEvent(topic, data)
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
