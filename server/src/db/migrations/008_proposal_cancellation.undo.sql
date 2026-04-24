-- ============================================================
-- Undo Migration 008: Proposal cancellation support
-- ============================================================

ALTER TABLE proposals
DROP COLUMN IF EXISTS cancelled;
