-- Migration 025: trusted creator course draft workflow
CREATE TABLE IF NOT EXISTS course_drafts (
    id              SERIAL PRIMARY KEY,
    author_addr     TEXT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    difficulty      TEXT NOT NULL DEFAULT 'beginner',
    status          TEXT NOT NULL DEFAULT 'draft',
    content         JSONB NOT NULL DEFAULT '{}'::jsonb,
    review_notes    TEXT,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_course_drafts_author_addr ON course_drafts (author_addr);
CREATE INDEX IF NOT EXISTS idx_course_drafts_status ON course_drafts (status);
