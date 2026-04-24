-- Linked Stellar wallets per user cluster (one row per wallet; each wallet at most one cluster).
CREATE TABLE IF NOT EXISTS linked_wallets (
    id BIGSERIAL PRIMARY KEY,
    cluster_id UUID NOT NULL,
    wallet_address TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_linked_wallets_address UNIQUE (wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_linked_wallets_cluster_id
    ON linked_wallets (cluster_id);

COMMENT ON TABLE linked_wallets IS 'Groups multiple Stellar wallets; exactly one is_primary per cluster (enforced in application layer).';
