import type { LrnBalanceDelta } from "../lib/lrn-events"
import { pool } from "./index"

/**
 * Persistence for the LRN balance projection.
 *
 * `lrn_balance_events` is the append-only source of truth; `scholar_balances`
 * is a running total maintained alongside it so the leaderboard never has to
 * aggregate the journal at read time.
 */

export interface ApplyDeltasResult {
	/** Journal rows newly written -- deltas that actually moved a balance. */
	applied: number
	/** Deltas skipped because their event id was already journalled. */
	duplicates: number
	/** Post-update balances of every address this batch touched. */
	balances: Array<{ address: string; lrnBalance: bigint }>
}

interface ApplyRow {
	address: string
	lrn_balance: string
	applied: number
}

/**
 * Apply a batch of balance deltas exactly once.
 *
 * Everything happens in one statement, so the journal write and the balance
 * update commit or roll back together -- there is no window in which an event is
 * recorded as processed without its delta landing, or vice versa. Re-running the
 * same batch is a no-op: the primary key on `event_id` absorbs the replay and
 * the aggregate below only sees rows the insert actually created.
 *
 * Complexity: O(n) rows shipped in a single round trip (n = batch size), with
 * one hash aggregation over the newly inserted rows. The balance table is
 * touched once per *distinct address* rather than once per event, which is what
 * keeps a backfill of a busy ledger range cheap. Contrast with the naive
 * per-event upsert, which costs 2n round trips.
 */
export async function applyLrnBalanceDeltas(
	deltas: LrnBalanceDelta[],
): Promise<ApplyDeltasResult> {
	if (deltas.length === 0) {
		return { applied: 0, duplicates: 0, balances: [] }
	}

	// Collapse repeats inside the batch first. A single statement cannot resolve
	// two rows carrying the same conflict key, and doing it here is O(n) against
	// a hash map instead of a DISTINCT ON sort in the database.
	const unique = new Map<string, LrnBalanceDelta>()
	for (const delta of deltas) {
		if (!unique.has(delta.eventId)) unique.set(delta.eventId, delta)
	}
	const batch = [...unique.values()]

	const result = await pool.query<ApplyRow>(
		`WITH input AS (
			SELECT * FROM UNNEST(
				$1::text[], $2::text[], $3::numeric[], $4::text[],
				$5::bigint[], $6::text[], $7::timestamptz[]
			) AS t(event_id, address, delta, event_type, ledger_sequence, tx_hash, occurred_at)
		),
		journalled AS (
			INSERT INTO lrn_balance_events
				(event_id, address, delta, event_type, ledger_sequence, tx_hash, occurred_at)
			SELECT event_id, address, delta, event_type, ledger_sequence, tx_hash, occurred_at
			FROM input
			ON CONFLICT (event_id) DO NOTHING
			RETURNING address, delta
		),
		aggregated AS (
			SELECT address, SUM(delta) AS delta, COUNT(*)::int AS applied
			FROM journalled
			GROUP BY address
		),
		upserted AS (
			INSERT INTO scholar_balances (address, lrn_balance, updated_at)
			-- Deterministic address order keeps concurrent indexer instances from
			-- deadlocking against each other on overlapping batches.
			SELECT address, delta, CURRENT_TIMESTAMP FROM aggregated ORDER BY address
			ON CONFLICT (address) DO UPDATE
				SET lrn_balance = scholar_balances.lrn_balance + EXCLUDED.lrn_balance,
					updated_at  = CURRENT_TIMESTAMP
			RETURNING address, lrn_balance
		)
		SELECT u.address, u.lrn_balance::text AS lrn_balance, a.applied
		FROM upserted u
		JOIN aggregated a ON a.address = u.address`,
		[
			batch.map((d) => d.eventId),
			batch.map((d) => d.address),
			batch.map((d) => d.delta.toString()),
			batch.map((d) => d.eventType),
			batch.map((d) => d.ledgerSequence),
			batch.map((d) => d.txHash),
			batch.map((d) => d.occurredAt?.toISOString() ?? null),
		],
	)

	const rows = result.rows ?? []
	const applied = rows.reduce((sum, row) => sum + Number(row.applied), 0)

	return {
		applied,
		duplicates: deltas.length - applied,
		balances: rows.map((row) => ({
			address: row.address,
			lrnBalance: BigInt(row.lrn_balance),
		})),
	}
}

/**
 * Recompute every `scholar_balances.lrn_balance` from the journal.
 *
 * The incremental path above is already exactly-once, so this exists for
 * recovery rather than routine use: repairing a balance edited out of band, or
 * finishing a backfill that imported journal rows out of order. It is safe to
 * run at any time and always converges on SUM(delta) per address.
 *
 * Complexity: one sequential scan of the journal with a hash aggregation,
 * O(events) time and O(distinct addresses) memory inside Postgres.
 */
export async function rebuildScholarBalances(): Promise<{
	addresses: number
	zeroed: number
}> {
	const client = await pool.connect()
	try {
		await client.query("BEGIN")

		const rebuilt = await client.query(
			`WITH totals AS (
				SELECT address, SUM(delta) AS lrn_balance
				FROM lrn_balance_events
				GROUP BY address
			)
			INSERT INTO scholar_balances (address, lrn_balance, updated_at)
			SELECT address, lrn_balance, CURRENT_TIMESTAMP FROM totals ORDER BY address
			ON CONFLICT (address) DO UPDATE
				SET lrn_balance = EXCLUDED.lrn_balance,
					updated_at  = CURRENT_TIMESTAMP`,
		)

		// Rows with a balance but no journal history are stale by definition --
		// the journal is the source of truth. Other columns (courses_completed)
		// belong to different writers and are left untouched.
		const zeroed = await client.query(
			`UPDATE scholar_balances b
			 SET lrn_balance = 0, updated_at = CURRENT_TIMESTAMP
			 WHERE b.lrn_balance <> 0
			   AND NOT EXISTS (
				   SELECT 1 FROM lrn_balance_events e WHERE e.address = b.address
			   )`,
		)

		await client.query("COMMIT")
		return {
			addresses: rebuilt.rowCount ?? 0,
			zeroed: zeroed.rowCount ?? 0,
		}
	} catch (err) {
		await client.query("ROLLBACK")
		throw err
	} finally {
		client.release()
	}
}

/**
 * Highest ledger present in the journal, or `null` when it is empty.
 * Used as a checkpoint fallback when `indexer_state` has no row yet.
 */
export async function getJournalMaxLedger(): Promise<number | null> {
	const result = await pool.query<{ max_ledger: string | null }>(
		"SELECT MAX(ledger_sequence)::text AS max_ledger FROM lrn_balance_events",
	)
	const value = result.rows[0]?.max_ledger
	return value === null || value === undefined ? null : Number(value)
}

export const scholarBalanceStore = {
	applyLrnBalanceDeltas,
	rebuildScholarBalances,
	getJournalMaxLedger,
}
