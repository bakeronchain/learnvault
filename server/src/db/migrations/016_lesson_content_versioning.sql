-- ============================================================
-- Migration 016: Course content versioning for lessons + enrollment pinning
-- ============================================================

ALTER TABLE lessons
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS superseded_by INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS change_summary TEXT;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'lessons_course_id_order_index_key'
    ) THEN
        ALTER TABLE lessons DROP CONSTRAINT lessons_course_id_order_index_key;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lessons_course_order_version_unique
    ON lessons (course_id, order_index, version);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lessons_course_order_active_unique
    ON lessons (course_id, order_index)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_lessons_course_version
    ON lessons (course_id, version DESC);

ALTER TABLE enrollments
    ADD COLUMN IF NOT EXISTS content_version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_enrollments_course_version
    ON enrollments (course_id, content_version);
