-- ============================================================
-- Migration 029: Passkey smart wallet credentials
-- ============================================================

-- Off-chain mirror of the signer list stored on each deployed
-- PasskeyWallet contract (contracts/passkey_wallet). The chain remains the
-- source of truth for authorization; this table lets the backend answer
-- "which contract does this credential belong to" without a chain read, and
-- lets a learner see their registered devices.
CREATE TABLE IF NOT EXISTS passkey_credentials (
    contract_address TEXT NOT NULL,
    credential_id    TEXT NOT NULL,
    public_key       TEXT NOT NULL,
    device_label     TEXT,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (contract_address, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_passkey_credentials_contract_address
    ON passkey_credentials (contract_address);
