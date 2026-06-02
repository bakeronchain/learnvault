-- ============================================================
-- Migration 017: Admin API key rotation system
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_api_keys (
    id                    SERIAL PRIMARY KEY,
    admin_address         TEXT NOT NULL,
    key_hash              TEXT NOT NULL UNIQUE,
    key_name              TEXT NOT NULL,
    is_active             BOOLEAN NOT NULL DEFAULT true,
    last_rotated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at            TIMESTAMP WITH TIME ZONE,
    rotation_reason       TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_api_keys_admin_address
    ON admin_api_keys (admin_address);

CREATE INDEX IF NOT EXISTS idx_admin_api_keys_hash
    ON admin_api_keys (key_hash, is_active);

CREATE TABLE IF NOT EXISTS admin_key_rotation_history (
    id                    SERIAL PRIMARY KEY,
    admin_address         TEXT NOT NULL,
    old_key_hash          TEXT NOT NULL,
    new_key_hash          TEXT NOT NULL,
    rotation_reason       TEXT NOT NULL,
    rotated_by            TEXT NOT NULL,
    carried_out_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_address) REFERENCES admin_api_keys(admin_address) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_key_rotation_history_address
    ON admin_key_rotation_history (admin_address, carried_out_at DESC);
