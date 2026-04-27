-- User profiles table for rich profile data (bio, avatar, social links, etc.)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stellar_address TEXT NOT NULL UNIQUE REFERENCES linked_wallets(stellar_address) ON DELETE CASCADE,
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    avatar_cid TEXT,
    social_links JSONB DEFAULT '{}'::jsonb,
    reputation_rank INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick lookup by stellar address
CREATE INDEX IF NOT EXISTS idx_user_profiles_stellar_address ON user_profiles (stellar_address);

-- Index for searching by display name
CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name ON user_profiles (display_name) WHERE display_name IS NOT NULL;

-- Trigger to update updated_at on modification
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trigger_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_user_profiles_updated_at();
