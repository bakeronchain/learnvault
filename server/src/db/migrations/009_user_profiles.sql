-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    address VARCHAR(255) PRIMARY KEY,
    display_name VARCHAR(50) UNIQUE,
    bio TEXT,
    avatar_url VARCHAR(2048),
    twitter VARCHAR(255),
    github VARCHAR(255),
    website VARCHAR(2048),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Case-insensitive index for display_name uniqueness is handled by UNIQUE constraint if we use citext, 
-- but since we are using VARCHAR, we can create a unique index on LOWER(display_name).
-- However, PostgreSQL UNIQUE constraints are case-sensitive. Let's create a unique index for case-insensitivity:
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_display_name_lower ON user_profiles (LOWER(display_name));
