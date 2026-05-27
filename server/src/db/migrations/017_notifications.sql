-- ============================================================
-- Migration 017: In-app notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    id                SERIAL PRIMARY KEY,
    recipient_address TEXT    NOT NULL,
    type              TEXT    NOT NULL,
    message           TEXT    NOT NULL,
    href              TEXT,
    data              JSONB   NOT NULL DEFAULT '{}'::jsonb,
    is_read           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
    ON notifications (recipient_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
    ON notifications (recipient_address, is_read)
    WHERE is_read = FALSE;
