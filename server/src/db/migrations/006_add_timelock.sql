-- Migration: Add timelock support to governance proposals
-- Issue #586

ALTER TABLE proposals
    ADD COLUMN IF NOT EXISTS queued_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS execution_ready_at TIMESTAMP WITH TIME ZONE;

-- Allow 'queued' status for proposals in timelock
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_status_check;
ALTER TABLE proposals
    ADD CONSTRAINT proposals_status_check
    CHECK (status IN ('pending', 'approved', 'queued', 'rejected'));
