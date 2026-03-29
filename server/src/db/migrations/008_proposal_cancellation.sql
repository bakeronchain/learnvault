-- ============================================================
-- Migration 008: Proposal cancellation support
-- ============================================================

ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS cancelled BOOLEAN NOT NULL DEFAULT FALSE;
