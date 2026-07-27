-- ============================================================
-- Migration 027: Bounty board — sponsors post paid coding tasks
-- ============================================================

CREATE TABLE IF NOT EXISTS bounties (
    id            SERIAL PRIMARY KEY,
    sponsor_addr  TEXT NOT NULL,
    title         TEXT NOT NULL,
    description   TEXT NOT NULL,
    skill_tags    TEXT[] NOT NULL DEFAULT '{}',
    reward_usdc   NUMERIC(20, 7) NOT NULL CHECK (reward_usdc > 0),
    escrow_tx     TEXT,
    status        TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','claimed','submitted','approved','paid','cancelled')),
    claimed_by    TEXT,
    deadline      TIMESTAMPTZ,
    payout_tx     TEXT,
    reward_tx     TEXT,
    approved_at   TIMESTAMPTZ,
    paid_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bounty_submissions (
    id           SERIAL PRIMARY KEY,
    bounty_id    INTEGER NOT NULL REFERENCES bounties(id) ON DELETE CASCADE,
    learner_addr TEXT NOT NULL,
    repo_url     TEXT,
    notes        TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (bounty_id, learner_addr)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties (status);
CREATE INDEX IF NOT EXISTS idx_bounties_sponsor ON bounties (LOWER(sponsor_addr));
CREATE INDEX IF NOT EXISTS idx_bounties_claimed_by ON bounties (LOWER(claimed_by));
CREATE INDEX IF NOT EXISTS idx_bounties_deadline ON bounties (deadline) WHERE deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bounties_skill_tags ON bounties USING GIN (skill_tags);
CREATE INDEX IF NOT EXISTS idx_bounties_created_at ON bounties (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bounty_submissions_bounty ON bounty_submissions (bounty_id);
