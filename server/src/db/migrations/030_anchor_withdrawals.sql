-- ============================================================
-- Migration 030: Anchor cash-out withdrawals (#1053)
-- ============================================================
-- Tracks SEP-24 interactive withdrawals a learner has started against a
-- vetted anchor (see server/src/config/anchors.ts for the allowlist).
-- One row per anchor-side transaction; status is reconciled from the
-- anchor's own GET /transactions?id= via POST
-- /api/anchors/:domain/withdrawals/:transactionId/reconcile (client-driven,
-- not a background worker — see services/anchor.service.ts's
-- reconcileWithdrawal doc comment for why) until it reaches a terminal state.

CREATE TABLE IF NOT EXISTS anchor_withdrawals (
  id             SERIAL PRIMARY KEY,
  learner_addr   TEXT NOT NULL,
  anchor_domain  TEXT NOT NULL,
  transaction_id TEXT NOT NULL,           -- anchor-side SEP-24 id
  amount_in      NUMERIC NOT NULL,        -- USDC debited
  asset_out      TEXT NOT NULL,           -- e.g. NGN, KES
  amount_out     NUMERIC,                 -- filled once known
  quote_id       TEXT,                    -- SEP-38 firm quote
  status         TEXT NOT NULL DEFAULT 'incomplete',
  status_message TEXT,
  stellar_tx_id  TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (anchor_domain, transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_anchor_withdrawals_learner_addr
    ON anchor_withdrawals (learner_addr);

CREATE INDEX IF NOT EXISTS idx_anchor_withdrawals_status
    ON anchor_withdrawals (status);
