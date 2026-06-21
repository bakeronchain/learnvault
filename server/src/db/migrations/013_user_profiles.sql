-- User profiles table for rich profile data (bio, avatar, social links, etc.)
-- This migration is expected to run on multiple baseline schema states.
-- Make it idempotent and tolerant of older column names (e.g. `address`).

-- Create the v2 schema only if the table does not exist at all.
-- If it exists (from an older migration), we avoid destructive changes.
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

-- Create whichever lookup index matches the active schema.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'stellar_address'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_profiles_stellar_address ON user_profiles (stellar_address)';
    ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'address'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_profiles_address ON user_profiles (address)';
    END IF;
END $$;

-- Index for searching by display name (safe even if display_name doesn't exist)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'display_name'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name ON user_profiles (display_name) WHERE display_name IS NOT NULL';
    END IF;
END $$;

-- Trigger to update updated_at on modification (only if updated_at exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'updated_at'
    ) THEN
        EXECUTE $func$
            CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
            RETURNS TRIGGER AS $trig$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $trig$ LANGUAGE plpgsql
        $func$;

        DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON user_profiles;
        CREATE TRIGGER trigger_user_profiles_updated_at
            BEFORE UPDATE ON user_profiles
            FOR EACH ROW
            EXECUTE FUNCTION update_user_profiles_updated_at();
    END IF;
END $$;
