-- ============================================================
-- Undo Migration 009: Flagged content moderation
-- ============================================================

ALTER TABLE comments DROP COLUMN IF EXISTS hidden_at;
ALTER TABLE comments DROP COLUMN IF EXISTS flag_count;

DROP TABLE IF EXISTS flagged_content;
