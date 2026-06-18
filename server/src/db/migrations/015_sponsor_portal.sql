-- ============================================================
-- Migration 015: Organization sponsor portal + scholar region self-reporting
-- ============================================================

CREATE TABLE IF NOT EXISTS sponsor_organizations (
    id SERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    logo_url TEXT,
    website TEXT,
    mission TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sponsor_track_donations (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES sponsor_organizations(id) ON DELETE CASCADE,
    track TEXT NOT NULL,
    donation_usdc NUMERIC(20, 7) NOT NULL CHECK (donation_usdc >= 0),
    tx_hash TEXT,
    sponsored_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sponsor_track_donations_org_id
    ON sponsor_track_donations (organization_id);

CREATE INDEX IF NOT EXISTS idx_sponsor_track_donations_track
    ON sponsor_track_donations (LOWER(track));

CREATE INDEX IF NOT EXISTS idx_sponsor_track_donations_sponsored_at
    ON sponsor_track_donations (sponsored_at DESC);

CREATE TABLE IF NOT EXISTS scholar_regions (
    learner_address TEXT PRIMARY KEY,
    country_region TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scholar_regions_country_region
    ON scholar_regions (LOWER(country_region));

CREATE OR REPLACE FUNCTION set_sponsor_organizations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sponsor_organizations_updated_at ON sponsor_organizations;
CREATE TRIGGER trg_sponsor_organizations_updated_at
    BEFORE UPDATE ON sponsor_organizations
    FOR EACH ROW
    EXECUTE FUNCTION set_sponsor_organizations_updated_at();

CREATE OR REPLACE FUNCTION set_scholar_regions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scholar_regions_updated_at ON scholar_regions;
CREATE TRIGGER trg_scholar_regions_updated_at
    BEFORE UPDATE ON scholar_regions
    FOR EACH ROW
    EXECUTE FUNCTION set_scholar_regions_updated_at();
