import { rpc as StellarRpc } from "@stellar/stellar-sdk"
import {
	applyLrnBalanceDeltas,
	getJournalMaxLedger,
	rebuildScholarBalances,
} from "../db/scholar-balance-store"
import { CONTRACT_IDS, INDEXER_CONFIG, SOROBAN_RPC_URL } from "../lib/event-config"
import { leaderboardEmitter } from "../lib/leaderboard-emitter"
import { logger } from "../lib/logger"
import {
	decodeLrnBalanceDelta,
	lrnEventTopicFilters,
	type LrnBalanceDelta,
	type RawContractEvent,
} from "../lib/lrn-events"
import { CacheKey, getRpcCache } from "../lib/rpc-cache"
import {
	getLastIndexedLedger,
	updateIndexerState,
} from "./event-indexer.service"

/**
 * Projects `learn_token` mint/burn events into `scholar_balances`, the table
 * behind GET /api/scholars/leaderboard.
 *
 * The pipeline is fetch -> decode -> apply -> checkpoint. Only the apply step
 * mutates state, and it is exactly-once (see db/scholar-balance-store), so every
 * other step is free to retry, overlap or restart. That is what makes the whole
 * indexer idempotent: a crash between two pages simply replays those pages on
 * the next tick and the duplicate deltas collapse in the database.
 */

const log = logger.child({ module: "lrn-balance-indexer" })

const rpcServer = new StellarRpc.Server(SOROBAN_RPC_URL)

/** Events per RPC page. Caps the memory a single sync holds at O(PAGE_SIZE). */
const PAGE_SIZE = 200

/**
 * Guard against a server that keeps handing back a cursor without making
 * progress. Bounds a single sync at PAGE_SIZE * MAX_PAGES events; whatever is
 * left is picked up on the next tick from the persisted checkpoint.
 */
const MAX_PAGES = 500

/**
 * Soroban RPC rejects a start ledger outside its retention window with the
 * available range in the message. Parsing it lets the indexer resume from the
 * oldest ledger the node still has instead of failing every tick forever.
 */
const LEDGER_RANGE_PATTERN = /ledger range:\s*(\d+)\s*[-–]\s*(\d+)/i

export interface IndexLrnResult {
	/** Raw events returned by the RPC across every page. */
	scanned: number
	/** Deltas written to the journal and folded into a balance. */
	applied: number
	/** Deltas skipped as already-processed replays. */
	duplicates: number
	/** Events that matched a topic but failed to decode. */
	malformed: number
	/** Highest ledger now covered by the checkpoint. */
	lastLedger: number
}

/**
 * `indexer_state` is keyed by contract; the balance projection tracks its own
 * position because it advances independently of the generic event archive.
 */
function checkpointKey(contractId: string): string {
	return `${contractId}:lrn_balances`
}

function learnTokenContractId(): string | null {
	const id = CONTRACT_IDS.learnToken
	return typeof id === "string" && id.length > 0 ? id : null
}

function parseRetainedRange(err: unknown): { oldest: number } | null {
	const message = err instanceof Error ? err.message : String(err)
	const match = LEDGER_RANGE_PATTERN.exec(message)
	return match ? { oldest: Number(match[1]) } : null
}

type EventsPage = {
	events: RawContractEvent[]
	cursor?: string
	latestLedger?: number | string
}

async function fetchPage(
	contractId: string,
	range: { startLedger?: number; endLedger?: number; cursor?: string },
): Promise<EventsPage> {
	// Both topics travel in one filter, so a page costs a single RPC round trip
	// regardless of how the mint/burn mix falls out.
	const filters = [
		{
			type: "contract" as const,
			contractIds: [contractId],
			topics: lrnEventTopicFilters(),
		},
	]

	// A cursor already encodes its position; sending it with startLedger is an
	// error on the RPC side.
	const request = range.cursor
		? { filters, cursor: range.cursor, limit: PAGE_SIZE }
		: {
				filters,
				startLedger: range.startLedger,
				endLedger: range.endLedger,
				limit: PAGE_SIZE,
			}

	return (await rpcServer.getEvents(
		request as Parameters<typeof rpcServer.getEvents>[0],
	)) as unknown as EventsPage
}

/**
 * Fold one page of raw events into the balance tables and return what changed.
 */
async function applyPage(events: RawContractEvent[]): Promise<{
	applied: number
	duplicates: number
	malformed: number
	touched: string[]
}> {
	const deltas: LrnBalanceDelta[] = []
	let malformed = 0

	for (const event of events) {
		const delta = decodeLrnBalanceDelta(event)
		if (delta) {
			deltas.push(delta)
		} else {
			// Topic filters are exact, so anything reaching here is a payload the
			// contract is not expected to emit. Skipping beats guessing a balance.
			malformed++
			log.warn({ eventId: event.id }, "Skipping undecodable LRN event")
		}
	}

	const result = await applyLrnBalanceDeltas(deltas)

	for (const { address, lrnBalance } of result.balances) {
		if (lrnBalance < 0n) {
			// Only reachable if the journal is missing the mints that preceded a
			// burn -- i.e. indexing started mid-history. Surfaced rather than
			// clamped so the gap is visible instead of silently distorting ranks.
			log.warn(
				{ address, lrnBalance: lrnBalance.toString() },
				"Negative LRN balance: journal is missing earlier mints, run the backfill",
			)
		}
	}

	return {
		applied: result.applied,
		duplicates: result.duplicates,
		malformed,
		touched: result.balances.map((b) => b.address),
	}
}

/**
 * Drop cached reads that the new balances invalidate and wake up leaderboard
 * subscribers. Best-effort: a cache miss is cheap, a failed sync is not, so
 * these never propagate an error back into the indexing loop.
 */
async function publishBalanceChanges(addresses: Set<string>): Promise<void> {
	if (addresses.size === 0) return

	const cache = getRpcCache()
	for (const address of addresses) {
		try {
			await cache.invalidate(CacheKey.learnBalance(address))
			await cache.invalidate(CacheKey.votingPower(address))
		} catch (err) {
			log.warn({ err, address }, "Cache invalidation failed")
		}
	}

	leaderboardEmitter.emitUpdate()
}

/**
 * Index every LRN balance event in `[startLedger, endLedger]`.
 *
 * Pages are applied as they arrive rather than accumulated, so memory stays at
 * O(PAGE_SIZE) no matter how wide the range is -- the property that lets the
 * same function serve both the 5-second poll and a full backfill.
 */
export async function indexLrnBalanceEvents(options: {
	startLedger: number
	endLedger?: number
	/** Defaults to true; the backfill disables it when replaying old ledgers. */
	persistCheckpoint?: boolean
}): Promise<IndexLrnResult> {
	const contractId = learnTokenContractId()
	if (!contractId) {
		log.warn("LEARN_TOKEN_CONTRACT_ID is not set, skipping LRN balance indexing")
		return {
			scanned: 0,
			applied: 0,
			duplicates: 0,
			malformed: 0,
			lastLedger: options.startLedger,
		}
	}

	// Ledger 0 does not exist; the RPC rejects it outright.
	let startLedger = Math.max(1, Math.floor(options.startLedger))
	const endLedger = options.endLedger
	const persistCheckpoint = options.persistCheckpoint ?? true

	const totals = { scanned: 0, applied: 0, duplicates: 0, malformed: 0 }
	const touched = new Set<string>()
	let lastLedger = startLedger - 1
	let cursor: string | undefined

	for (let page = 0; page < MAX_PAGES; page++) {
		let response: EventsPage
		try {
			response = await fetchPage(contractId, {
				startLedger: cursor ? undefined : startLedger,
				endLedger: cursor ? undefined : endLedger,
				cursor,
			})
		} catch (err) {
			const retained = cursor ? null : parseRetainedRange(err)
			if (!retained || retained.oldest <= startLedger) throw err

			// The window we wanted has aged out of the node. Nothing can recover
			// those events from RPC; the operator needs an archival source.
			log.warn(
				{ requested: startLedger, oldestRetained: retained.oldest },
				"Requested ledgers are outside RPC retention, resuming from oldest retained ledger",
			)
			startLedger = retained.oldest
			lastLedger = startLedger - 1
			response = await fetchPage(contractId, { startLedger, endLedger })
		}

		const events = response.events ?? []
		totals.scanned += events.length

		const pageResult = await applyPage(events)
		totals.applied += pageResult.applied
		totals.duplicates += pageResult.duplicates
		totals.malformed += pageResult.malformed
		for (const address of pageResult.touched) touched.add(address)

		for (const event of events) {
			const ledger = Number(event.ledger)
			if (Number.isFinite(ledger) && ledger > lastLedger) lastLedger = ledger
		}

		const nextCursor = response.cursor ?? events[events.length - 1]?.id
		if (events.length < PAGE_SIZE || !nextCursor || nextCursor === cursor) break
		cursor = nextCursor
	}

	await publishBalanceChanges(touched)

	// Checkpoint the end of the *requested* range, not the last ledger that
	// happened to contain an event -- otherwise quiet ranges would be rescanned
	// forever. `lastLedger` only wins when no explicit end was given.
	const checkpoint = Math.max(
		endLedger ?? lastLedger,
		lastLedger,
		startLedger - 1,
	)
	if (persistCheckpoint && checkpoint >= startLedger) {
		await updateIndexerState(checkpointKey(contractId), checkpoint)
	}

	if (totals.applied > 0 || totals.malformed > 0) {
		log.info(
			{ ...totals, startLedger, endLedger: checkpoint },
			"LRN balance events indexed",
		)
	}

	return { ...totals, lastLedger: checkpoint }
}

/**
 * Ledger to resume from on startup: the persisted checkpoint, else the journal's
 * high-water mark, else the configured starting ledger. Read from the database
 * on every call so the poller holds no recovery state of its own.
 */
export async function getLrnBalanceCheckpoint(): Promise<number> {
	const contractId = learnTokenContractId()
	if (!contractId) return INDEXER_CONFIG.startingLedger

	const persisted = await getLastIndexedLedger(checkpointKey(contractId))
	if (persisted > 0) return persisted

	const journalMax = await getJournalMaxLedger()
	return journalMax ?? INDEXER_CONFIG.startingLedger
}

/**
 * Catch the projection up to `latestLedger`. Called on every poll tick; a no-op
 * when the checkpoint is already current.
 */
export async function syncLrnBalances(
	latestLedger: number,
): Promise<IndexLrnResult | null> {
	const checkpoint = await getLrnBalanceCheckpoint()
	const startLedger = checkpoint + 1
	if (startLedger > latestLedger) return null

	return indexLrnBalanceEvents({ startLedger, endLedger: latestLedger })
}

export { rebuildScholarBalances }
