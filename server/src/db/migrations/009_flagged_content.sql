-- ============================================================
-- Migration 009: Flagged content moderation
-- ============================================================

CREATE TABLE IF NOT EXISTS flagged_content (
    id           SERIAL PRIMARY KEY,
    content_type TEXT NOT NULL CHECK (content_type IN ('comment')),
    content_id   INTEGER NOT NULL,
    reporter     TEXT NOT NULL,
    reason       TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dismissed', 'actioned')),
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at  TIMESTAMP WITH TIME ZONE,
    resolved_by  TEXT,
    UNIQUE (content_type, content_id, reporter)
);

CREATE INDEX IF NOT EXISTS idx_flagged_content_status
    ON flagged_content (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_flagged_content_lookup
    ON flagged_content (content_type, content_id);

-- Auto-hide column on comments (hidden when flag_count >= 3 and pending admin review)
ALTER TABLE comments ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS flag_count INTEGER NOT NULL DEFAULT 0;
