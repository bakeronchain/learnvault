-- ============================================================
-- Migration 025: Quadratic-funding rounds
-- DAO-run matching pools for scholarships. During a round, many
-- small donors contribute to scholarship proposals and a matching
-- pool is distributed using the quadratic-funding formula:
--   match ∝ (Σ√contribution)² − Σcontribution
-- normalized to the matching pool. This amplifies broad community
-- support over a few large donors.
-- ============================================================

CREATE TABLE IF NOT EXISTS qf_rounds (
    id            SERIAL PRIMARY KEY,
    name          TEXT           NOT NULL,
    matching_pool NUMERIC(20, 7) NOT NULL CHECK (matching_pool >= 0),
    start_ts      TIMESTAMPTZ    NOT NULL,
    end_ts        TIMESTAMPTZ    NOT NULL,
    status        TEXT           NOT NULL DEFAULT 'upcoming'
                  CHECK (status IN ('upcoming', 'active', 'finalized')),
    created_at    TIMESTAMPTZ    DEFAULT NOW(),
    -- A round must open before it closes
    CHECK (end_ts > start_ts)
);

CREATE TABLE IF NOT EXISTS qf_contributions (
    id          SERIAL PRIMARY KEY,
    round_id    INTEGER        NOT NULL REFERENCES qf_rounds(id) ON DELETE CASCADE,
    proposal_id INTEGER        NOT NULL,
    donor_addr  TEXT           NOT NULL,
    amount_usdc NUMERIC(20, 7) NOT NULL CHECK (amount_usdc > 0),
    tx_hash     TEXT           NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ    DEFAULT NOW()
);

-- Standings queries aggregate all contributions for a round grouped by proposal
CREATE INDEX IF NOT EXISTS idx_qf_contributions_round
    ON qf_contributions (round_id);

-- Unique-donor weighting groups by (round, proposal, donor)
CREATE INDEX IF NOT EXISTS idx_qf_contributions_round_proposal
    ON qf_contributions (round_id, proposal_id);

COMMENT ON TABLE qf_rounds IS 'DAO-run quadratic-funding rounds with a matching pool';
COMMENT ON TABLE qf_contributions IS 'Tx-verified donor contributions to a QF round, one row per on-chain contribution';
COMMENT ON COLUMN qf_contributions.tx_hash IS 'On-chain (Horizon) transaction hash; UNIQUE prevents double-recording';
