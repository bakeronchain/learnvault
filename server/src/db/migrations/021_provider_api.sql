-- ============================================================
-- Migration 021: Third-party provider integration API
-- Tables: provider_api_keys, provider_webhooks,
--         provider_webhook_deliveries
-- ============================================================

CREATE TABLE IF NOT EXISTS provider_api_keys (
    id                    SERIAL PRIMARY KEY,
    provider_name         TEXT NOT NULL,
    key_hash              TEXT NOT NULL UNIQUE,
    key_prefix            TEXT NOT NULL,
    scopes                TEXT[]  NOT NULL DEFAULT '{}',
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
    is_active             BOOLEAN NOT NULL DEFAULT true,
    created_by            TEXT    NOT NULL,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at          TIMESTAMP WITH TIME ZONE,
    revoked_at            TIMESTAMP WITH TIME ZONE,
    revoked_by            TEXT
);

CREATE INDEX IF NOT EXISTS idx_provider_api_keys_hash
    ON provider_api_keys (key_hash, is_active);

CREATE INDEX IF NOT EXISTS idx_provider_api_keys_active
    ON provider_api_keys (is_active, created_at DESC);

-- provider_key_id column on courses — links a course to the provider that submitted it
ALTER TABLE courses ADD COLUMN IF NOT EXISTS provider_key_id INTEGER REFERENCES provider_api_keys(id) ON DELETE SET NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS external_url TEXT;

CREATE INDEX IF NOT EXISTS idx_courses_provider_key
    ON courses (provider_key_id) WHERE provider_key_id IS NOT NULL;

-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS provider_completions (
    id               SERIAL PRIMARY KEY,
    learner_address  TEXT    NOT NULL,
    course_id        INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    milestone_id     INTEGER REFERENCES milestones(id) ON DELETE SET NULL,
    provider_key_id  INTEGER NOT NULL REFERENCES provider_api_keys(id) ON DELETE CASCADE,
    tx_hash          TEXT,
    completed_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_completions_unique
    ON provider_completions (learner_address, course_id, COALESCE(milestone_id, -1));

CREATE INDEX IF NOT EXISTS idx_provider_completions_provider
    ON provider_completions (provider_key_id, completed_at DESC);

-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS provider_webhooks (
    id              SERIAL PRIMARY KEY,
    api_key_id      INTEGER NOT NULL REFERENCES provider_api_keys(id) ON DELETE CASCADE,
    url             TEXT    NOT NULL,
    events          TEXT[]  NOT NULL DEFAULT '{}',
    signing_secret  TEXT    NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    failure_count   INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_triggered_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_provider_webhooks_api_key
    ON provider_webhooks (api_key_id, is_active);

-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS provider_webhook_deliveries (
    id              SERIAL PRIMARY KEY,
    webhook_id      INTEGER NOT NULL REFERENCES provider_webhooks(id) ON DELETE CASCADE,
    event_type      TEXT    NOT NULL,
    payload         JSONB   NOT NULL,
    status          TEXT    NOT NULL DEFAULT 'pending',
    attempts        INTEGER NOT NULL DEFAULT 0,
    response_status INTEGER,
    response_body   TEXT,
    delivered_at    TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook
    ON provider_webhook_deliveries (webhook_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status
    ON provider_webhook_deliveries (status, created_at);
