-- Indexes on-chain DelegateChanged and DelegateRemoved events for the governance token.
-- delegatee IS NULL means the row records an undelegation (DelegateRemoved).

CREATE TABLE delegation_events (
    id               SERIAL PRIMARY KEY,
    delegator        TEXT NOT NULL,
    delegatee        TEXT,
    tx_hash          TEXT,
    ledger_sequence  BIGINT,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_delegation_delegator ON delegation_events (delegator);
CREATE INDEX idx_delegation_delegatee ON delegation_events (delegatee)
    WHERE delegatee IS NOT NULL;
