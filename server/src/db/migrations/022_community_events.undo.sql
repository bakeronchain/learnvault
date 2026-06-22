-- ============================================================
-- Undo Migration 022: Drop community events table
-- ============================================================

DROP INDEX IF EXISTS idx_community_events_date;
DROP INDEX IF EXISTS idx_community_events_type;
DROP TABLE IF EXISTS community_events;
