-- ============================================================
-- Migration 023: Identity verifications table
-- Persists anti-sybil verification state per wallet address
-- per method: email, phone, government_id, biometric.
-- ============================================================

CREATE TABLE IF NOT EXISTS identity_verifications (
    id             SERIAL PRIMARY KEY,
    wallet_address TEXT        NOT NULL,
    method         TEXT        NOT NULL
                   CHECK (method IN ('email', 'phone', 'government_id', 'biometric')),
    status         TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'verified', 'failed')),
    -- Opaque reference returned by the external provider:
    --   phone        → Twilio Verification SID
    --   government_id / biometric → Smile Identity job_id
    --   email        → NULL (token is self-contained / stateless)
    provider_ref   TEXT,
    expires_at     TIMESTAMPTZ,
    verified_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- One record per method per wallet; re-initiating overwrites the previous attempt
    UNIQUE (wallet_address, method)
);

-- Supports O(log n) lookup of all verifications for a given wallet
CREATE INDEX IF NOT EXISTS idx_identity_verifications_wallet
    ON identity_verifications (wallet_address);

-- Supports admin queries filtering by status across all users
CREATE INDEX IF NOT EXISTS idx_identity_verifications_status
    ON identity_verifications (status);

CREATE OR REPLACE FUNCTION set_identity_verifications_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_identity_verifications_updated_at ON identity_verifications;
CREATE TRIGGER trg_identity_verifications_updated_at
    BEFORE UPDATE ON identity_verifications
    FOR EACH ROW
    EXECUTE FUNCTION set_identity_verifications_updated_at();

COMMENT ON TABLE identity_verifications IS 'Anti-sybil verification state per wallet address per method';
COMMENT ON COLUMN identity_verifications.provider_ref IS 'External provider reference: Twilio SID (phone), Smile Identity job_id (gov_id/biometric), NULL (email)';
