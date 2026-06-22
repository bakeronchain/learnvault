-- ============================================================
-- Migration 016: Bulk sponsor license grants
-- ============================================================

CREATE TABLE IF NOT EXISTS sponsor_license_grants (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES sponsor_organizations(id) ON DELETE CASCADE,
    recipient_wallet_address TEXT NOT NULL,
    license_type TEXT NOT NULL DEFAULT 'course_access',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'minted', 'failed')),
    tx_hash TEXT,
    amount_usdc NUMERIC(20, 7) NOT NULL CHECK (amount_usdc >= 0),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    minted_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sponsor_license_grants_org_id
    ON sponsor_license_grants (organization_id);

CREATE INDEX IF NOT EXISTS idx_sponsor_license_grants_recipient
    ON sponsor_license_grants (LOWER(recipient_wallet_address));

CREATE INDEX IF NOT EXISTS idx_sponsor_license_grants_status
    ON sponsor_license_grants (status);

CREATE INDEX IF NOT EXISTS idx_sponsor_license_grants_granted_at
    ON sponsor_license_grants (granted_at DESC);

COMMENT ON TABLE sponsor_license_grants IS 'Tracks bulk license grants purchased by sponsor organizations and credited to individual student wallets';
COMMENT ON COLUMN sponsor_license_grants.license_type IS 'Type of license granted (e.g., course_access, track_access)';
COMMENT ON COLUMN sponsor_license_grants.status IS 'Minting status: pending (queued), minted (on-chain), failed (error)';
COMMENT ON COLUMN sponsor_license_grants.metadata IS 'Additional grant metadata (course_id, track, notes, etc.)';
