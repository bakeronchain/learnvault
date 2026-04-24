-- Migration: 011_social_follows.sql
-- Create follows table to allow scholars to follow each other

CREATE TABLE IF NOT EXISTS follows (
    follower_address TEXT NOT NULL,
    following_address TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_address, following_address)
);

-- Index for counting followers (lookup by following_address)
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows (following_address);

-- Index for finding who a user is following (lookup by follower_address)
-- (Already covered by PK prefix, but explicit index for clarity if needed)
-- CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows (follower_address);
