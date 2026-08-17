-- 029_multi_asset_donations.sql
-- Adds source-asset columns to the existing contributions table so donation
-- records retain both the source asset and the received USDC amount.

-- Create a dedicated donations table if it doesn't exist yet, since the
-- existing qf_contributions table is specific to QF rounds.
CREATE TABLE IF NOT EXISTS donations (
    id SERIAL PRIMARY KEY,
    donor_address TEXT NOT NULL,
    treasury_address TEXT NOT NULL,
    -- Source asset (what the donor sent)
    source_asset_code TEXT NOT NULL DEFAULT 'USDC',
    source_asset_issuer TEXT,
    source_amount TEXT NOT NULL DEFAULT '0',
    -- Destination asset (what the treasury received, always USDC)
    dest_asset_code TEXT NOT NULL DEFAULT 'USDC',
    dest_amount TEXT NOT NULL DEFAULT '0',
    -- Transaction metadata
    tx_hash TEXT UNIQUE NOT NULL,
    slippage_pct NUMERIC(5, 2) DEFAULT 0.5,
    path_assets JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying donations by donor
CREATE INDEX IF NOT EXISTS idx_donations_donor
    ON donations (donor_address);

-- Index for querying donations by treasury
CREATE INDEX IF NOT EXISTS idx_donations_treasury
    ON donations (treasury_address);

-- Index for querying by source asset
CREATE INDEX IF NOT EXISTS idx_donations_source_asset
    ON donations (source_asset_code);
