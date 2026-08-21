-- ============================================================
-- Migration 031: Treasury deposits audit schema
-- ============================================================
-- Tracks USDC donations and governance token issuance for the community
-- treasury. Each row is an immutable record of one deposit transaction,
-- linking on-chain deposit (donor, amount, tx_hash) to the quantity of
-- governance tokens issued in return.

CREATE TABLE IF NOT EXISTS treasury_deposits (
    id              SERIAL PRIMARY KEY,
    donor_address   TEXT NOT NULL,
    amount_usdc     NUMERIC(20, 7) NOT NULL CHECK (amount_usdc > 0),
    gov_issued      NUMERIC(20, 7) NOT NULL CHECK (gov_issued > 0),
    tx_hash         TEXT NOT NULL UNIQUE
                        CHECK (tx_hash ~ '^[0-9a-fA-F]{64}$'),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_treasury_deposits_donor_created
    ON treasury_deposits (donor_address, created_at DESC);
