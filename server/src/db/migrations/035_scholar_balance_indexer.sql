-- ============================================================
-- Migration 035: Scholar LRN balance indexer
-- ============================================================
-- `scholar_balances` (migration 005) backs GET /api/scholars/leaderboard, but
-- until now nothing wrote to it. Balances are now projected from an append-only
-- journal of learn_token mint/burn events.
--
-- Why a journal instead of writing straight to scholar_balances:
--
--   1. Exactly-once application. Applying a balance change is a non-idempotent
--      read-modify-write (`lrn_balance += delta`). Keying every delta by its
--      globally unique Soroban event id, and applying it in the *same statement*
--      that inserts the journal row, makes replays provably safe -- poller
--      restarts, overlapping backfills and re-scanned ledger ranges all collapse
--      to a no-op instead of double-counting.
--
--   2. Rebuildability. Soroban RPC only retains a short window of recent events,
--      so the chain is not a durable source to re-read from. The journal lets
--      scholar_balances be recomputed exactly with SUM(delta) GROUP BY address.

CREATE TABLE IF NOT EXISTS lrn_balance_events (
    -- Soroban event id, "<ledger>-<tx_hash>-<index>". Globally unique, which is
    -- what makes the projection idempotent.
    event_id        TEXT PRIMARY KEY,
    address         TEXT NOT NULL,
    -- Signed atomic LRN: positive on mint, negative on burn. An i128 needs at
    -- most 39 digits, so NUMERIC(40, 0) holds any on-chain amount exactly.
    delta           NUMERIC(40, 0) NOT NULL,
    event_type      TEXT NOT NULL CHECK (event_type IN ('mint', 'burn')),
    ledger_sequence BIGINT NOT NULL,
    tx_hash         TEXT,
    occurred_at     TIMESTAMP WITH TIME ZONE,
    indexed_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Serves the checkpoint fallback (MAX(ledger_sequence)) and ledger-range audits.
-- No index on `address`: the only address-keyed query is the full-table rebuild,
-- which hash-aggregates over a sequential scan either way.
CREATE INDEX IF NOT EXISTS idx_lrn_balance_events_ledger
    ON lrn_balance_events (ledger_sequence);

COMMENT ON TABLE lrn_balance_events IS
    'Append-only journal of learn_token mint/burn events; source of truth for scholar_balances.lrn_balance';
COMMENT ON COLUMN lrn_balance_events.delta IS
    'Signed atomic LRN applied to scholar_balances.lrn_balance (positive on mint, negative on burn)';

-- scholar_balances and its leaderboard index are created by migration 005 and
-- are deliberately not redefined here. Its balance column is widened to match
-- the journal: migration 005 declared NUMERIC(30, 0), which cannot represent
-- every i128 the contract can emit, and an out-of-range amount would raise a
-- numeric overflow that stalls the indexer on the offending ledger forever.
ALTER TABLE scholar_balances
    ALTER COLUMN lrn_balance TYPE NUMERIC(40, 0);
