-- ============================================================
-- Migration 030: Gasless onboarding — sponsorship tracking
-- ============================================================
-- Backs the sponsored-reserves onboarding flow (issue #1054): a learner with
-- zero XLM gets their account created by the platform sponsor
-- (begin_sponsoring_future_reserves / create_account / end_sponsoring_future_reserves),
-- and subsequent enroll/submit-milestone transactions are relayed through a
-- fee-bump paid by the same sponsor. Both tables are the off-chain ledger
-- that lets the admin-facing sponsor-status endpoint answer "how many
-- accounts, how much is locked, how much have we spent today" without
-- replaying chain history on every request.

CREATE TABLE IF NOT EXISTS sponsored_accounts (
    learner_address        TEXT PRIMARY KEY,
    sponsor_tx_hash        TEXT NOT NULL,
    reserves_locked_stroops BIGINT NOT NULL,
    status                 TEXT NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'active', 'revoked')),
    created_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- First learner-initiated on-chain activity after sponsorship (relayed or
    -- direct). Null means "never used" — the reclamation candidate signal for
    -- a future admin tool; not consumed anywhere yet.
    activated_at           TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sponsored_accounts_status
    ON sponsored_accounts (status);

-- Append-only spend ledger. Both account creation (a fixed reserve cost) and
-- fee-bump relays record a row here; sponsor-status and the relayer's daily
-- spend ceiling both read it, never a separate running counter, so a crashed
-- write can never leave the ceiling check silently under-counting.
CREATE TABLE IF NOT EXISTS sponsor_spend_log (
    id              SERIAL PRIMARY KEY,
    spent_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    amount_stroops  BIGINT NOT NULL,
    kind            TEXT NOT NULL CHECK (kind IN ('create_account', 'fee_bump')),
    learner_address TEXT,
    tx_hash         TEXT
);

CREATE INDEX IF NOT EXISTS idx_sponsor_spend_log_spent_at
    ON sponsor_spend_log (spent_at);
