-- ============================================================
-- Migration 017: Add prerequisites column to courses table
-- ============================================================

ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS prerequisites INTEGER[] NOT NULL DEFAULT '{}';
