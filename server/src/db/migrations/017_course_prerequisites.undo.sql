-- ============================================================
-- Migration 017 Undo: Remove prerequisites column from courses
-- ============================================================

ALTER TABLE courses
    DROP COLUMN IF EXISTS prerequisites;
