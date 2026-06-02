-- ============================================================
-- Migration 014: Add idempotency constraints for event indexer
-- ============================================================

-- Add tx_hash and event_index columns to events table for unique identification
ALTER TABLE events 
    ADD COLUMN IF NOT EXISTS tx_hash TEXT,
    ADD COLUMN IF NOT EXISTS event_index INTEGER;

-- Create unique constraint on (ledger_sequence, tx_hash, event_index)
-- This ensures duplicate events are not inserted even on poller restart
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_unique 
    ON events (ledger_sequence, tx_hash, event_index) 
    WHERE tx_hash IS NOT NULL AND event_index IS NOT NULL;

-- Partial index for events without tx_hash (backward compatibility)
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_unique_no_tx 
    ON events (contract, ledger_sequence) 
    WHERE tx_hash IS NULL;

-- Index for fast duplicate checking
CREATE INDEX IF NOT EXISTS idx_events_ledger_tx 
    ON events (ledger_sequence, tx_hash, event_index);

-- ============================================================
-- Indexer state table for tracking last processed ledger
-- ============================================================

CREATE TABLE IF NOT EXISTS indexer_state (
    id SERIAL PRIMARY KEY,
    contract TEXT NOT NULL UNIQUE,
    last_processed_ledger BIGINT NOT NULL DEFAULT 0,
    last_processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_indexer_state_contract 
    ON indexer_state (contract);

COMMENT ON TABLE indexer_state IS 'Tracks last processed ledger per contract for indexer restart recovery';
COMMENT ON COLUMN indexer_state.last_processed_ledger IS 'Highest ledger sequence successfully indexed for this contract';
