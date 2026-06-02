-- ============================================================
-- Migration 009: Content moderation and flagging system
-- ============================================================

CREATE TABLE IF NOT EXISTS flagged_content (
    id                 SERIAL PRIMARY KEY,
    content_type       TEXT NOT NULL CHECK (content_type IN ('comment', 'proposal')),
    content_id         INTEGER NOT NULL,
    reporter_address   TEXT NOT NULL,
    reason             TEXT NOT NULL,
    flag_count         INTEGER DEFAULT 1,
    status             TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
    admin_action       TEXT CHECK (admin_action IN ('deleted', 'dismissed', 'warned')),
    admin_address      TEXT,
    admin_notes        TEXT,
    is_hidden          BOOLEAN DEFAULT FALSE,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at        TIMESTAMP WITH TIME ZONE,
    UNIQUE(content_type, content_id, reporter_address)
);

CREATE INDEX IF NOT EXISTS idx_flagged_content_status_created_at
    ON flagged_content (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_flagged_content_hidden
    ON flagged_content (is_hidden) WHERE is_hidden = TRUE;

CREATE TABLE IF NOT EXISTS flag_audit_log (
    id              SERIAL PRIMARY KEY,
    flagged_id      INTEGER REFERENCES flagged_content(id) ON DELETE CASCADE,
    action          TEXT NOT NULL,
    actor_address   TEXT NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_flag_audit_log_flagged_id
    ON flag_audit_log (flagged_id);
