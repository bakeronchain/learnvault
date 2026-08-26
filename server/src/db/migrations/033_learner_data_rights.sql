-- Migration 033: NDPR/GDPR learner exports and grace-period account deletion

CREATE TABLE IF NOT EXISTS learner_data_exports (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address      TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
    archive             BYTEA,
    download_expires_at TIMESTAMPTZ,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_learner_data_exports_owner
    ON learner_data_exports (wallet_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learner_data_exports_pending
    ON learner_data_exports (created_at)
    WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS account_deletion_requests (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL UNIQUE,
    status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'processing', 'cancelled', 'completed')),
    erase_after    TIMESTAMPTZ NOT NULL,
    cancelled_at   TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_due
    ON account_deletion_requests (erase_after)
    WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS account_deletion_audit_log (
    id                     BIGSERIAL PRIMARY KEY,
    deletion_request_id    UUID NOT NULL
                           REFERENCES account_deletion_requests(id) ON DELETE RESTRICT,
    subject_address_hash   TEXT NOT NULL,
    action                 TEXT NOT NULL CHECK (action IN ('hard_deleted')),
    occurred_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE account_deletion_audit_log IS
    'Admin-visible, non-reversible audit trail for completed account erasures';
