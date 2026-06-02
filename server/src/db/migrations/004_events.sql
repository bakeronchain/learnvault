-- ============================================================
-- Migration 004: On-chain events table for indexing contract events
-- ============================================================

-- Events table: stores historical Soroban contract events
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    contract TEXT NOT NULL,
    event_type TEXT NOT NULL,
    data JSONB NOT NULL,
    ledger_sequence BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contract, ledger_sequence)
);

-- Index for fast lookups by contract + event type + ledger (idempotency checks)
CREATE INDEX IF NOT EXISTS idx_events_contract_event_ledger 
    ON events (contract, event_type, ledger_sequence);

-- GIN index for JSONB data queries (address in data.address)
CREATE INDEX IF NOT EXISTS idx_events_data_gin 
    ON events USING GIN (data);

-- Composite index for API queries
CREATE INDEX IF NOT EXISTS idx_events_contract_type 
    ON events (contract, event_type);

-- Index for recent events
CREATE INDEX IF NOT EXISTS idx_events_created_at 
    ON events (created_at DESC);

COMMENT ON TABLE events IS 'Stores historical Soroban contract events for leaderboards/activity feeds';
COMMENT ON COLUMN events.data IS 'Parsed event data as JSONB (address, amount, etc)';

