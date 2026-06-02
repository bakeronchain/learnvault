-- ============================================================
-- Migration 018: Notification delivery preferences and push subscriptions
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_push_subscriptions (
    id                SERIAL PRIMARY KEY,
    recipient_address TEXT NOT NULL,
    endpoint          TEXT NOT NULL,
    p256dh            TEXT NOT NULL,
    auth              TEXT NOT NULL,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(recipient_address, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_notification_push_subscriptions_address
    ON notification_push_subscriptions (recipient_address);

CREATE TABLE IF NOT EXISTS notification_preferences (
    recipient_address       TEXT PRIMARY KEY,
    milestone_approved      BOOLEAN NOT NULL DEFAULT TRUE,
    milestone_rejected      BOOLEAN NOT NULL DEFAULT TRUE,
    vote_result             BOOLEAN NOT NULL DEFAULT TRUE,
    disbursement            BOOLEAN NOT NULL DEFAULT TRUE,
    email_milestone_approved BOOLEAN NOT NULL DEFAULT FALSE,
    email_milestone_rejected BOOLEAN NOT NULL DEFAULT FALSE,
    email_vote_result        BOOLEAN NOT NULL DEFAULT FALSE,
    email_disbursement       BOOLEAN NOT NULL DEFAULT FALSE,
    quiet_hours_start       TIME,
    quiet_hours_end         TIME,
    quiet_hours_timezone    TEXT,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_delivery_log (
    id                SERIAL PRIMARY KEY,
    recipient_address TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    channel           TEXT NOT NULL,
    status            TEXT NOT NULL,
    details           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
