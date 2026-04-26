-- Linked Stellar addresses for a single logical account
CREATE TABLE IF NOT EXISTS linked_wallets (
    account_id UUID NOT NULL,
    stellar_address TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (stellar_address)
);
CREATE INDEX IF NOT EXISTS idx_linked_wallets_account_id ON linked_wallets (account_id);
CREATE UNIQUE INDEX IF NOT EXISTS linked_wallets_one_primary_per_account ON linked_wallets (account_id) WHERE is_primary;
