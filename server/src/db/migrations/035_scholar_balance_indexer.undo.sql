-- Undo Migration 035: drop the LRN balance journal.
--
-- scholar_balances itself is owned by migration 005 and is left in place. Its
-- balances are zeroed first because the journal that justified those values is
-- going away, and because the column has to fit back inside migration 005's
-- narrower NUMERIC(30, 0).

UPDATE scholar_balances SET lrn_balance = 0, updated_at = CURRENT_TIMESTAMP;

ALTER TABLE scholar_balances
    ALTER COLUMN lrn_balance TYPE NUMERIC(30, 0);

DROP INDEX IF EXISTS idx_lrn_balance_events_ledger;
DROP TABLE IF EXISTS lrn_balance_events;
