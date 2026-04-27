-- Undo migration 014: Remove idempotency constraints for event indexer

-- Drop indexes
DROP INDEX IF EXISTS idx_events_unique;
DROP INDEX IF EXISTS idx_events_unique_no_tx;
DROP INDEX IF EXISTS idx_events_ledger_tx;
DROP INDEX IF EXISTS idx_indexer_state_contract;

-- Drop columns from events table
ALTER TABLE events 
    DROP COLUMN IF EXISTS tx_hash,
    DROP COLUMN IF EXISTS event_index;

-- Drop indexer_state table
DROP TABLE IF EXISTS indexer_state;
