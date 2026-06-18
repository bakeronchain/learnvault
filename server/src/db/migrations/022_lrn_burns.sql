-- On-chain LRN burn records (atomic amount, Soroban tx hash)
CREATE TABLE IF NOT EXISTS lrn_burns (
    id SERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    amount BIGINT NOT NULL CHECK (amount > 0),
    tx_hash TEXT NOT NULL UNIQUE,
    burned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lrn_burns_wallet ON lrn_burns (wallet_address);
CREATE INDEX IF NOT EXISTS idx_lrn_burns_burned_at ON lrn_burns (burned_at DESC);

COMMENT ON TABLE lrn_burns IS 'Persisted learn_token burn transactions';
COMMENT ON COLUMN lrn_burns.amount IS 'LRN amount in contract atomic units (7 decimals)';
