-- ============================================================
-- Migration 027: Referrals table for on-chain referrals program
-- ============================================================

-- requires a referrer and referred addresses
-- have a enum of status

CREATE TABLE IF NOT EXISTS referrals (
  id                SERIAL PRIMARY KEY,
  referrer_addr     TEXT NOT NULL,
  referred_addr     TEXT NOT NULL UNIQUE,
  code              TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending', -- pending|qualified|rewarded
  qualified_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals (referrer_addr);
CREATE INDEX IF NOT EXISTS idx_referrals_code     ON referrals (code);
