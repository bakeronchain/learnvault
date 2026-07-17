-- ============================================================
-- Migration 025: Achievement badges table
-- ============================================================

-- Achievement badges table: stores awarded achievement badges
CREATE TABLE IF NOT EXISTS achievement_badges (
    id SERIAL PRIMARY KEY,
    learner_addr TEXT NOT NULL,
    badge_type TEXT NOT NULL,
    token_id TEXT,
    tx_hash TEXT,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (learner_addr, badge_type)
);

-- Index for fast lookups by learner address
CREATE INDEX IF NOT EXISTS idx_achievement_badges_learner_addr 
    ON achievement_badges (learner_addr);

-- Index for badge type lookups
CREATE INDEX IF NOT EXISTS idx_achievement_badges_badge_type 
    ON achievement_badges (badge_type);

-- Index for token ID lookups
CREATE INDEX IF NOT EXISTS idx_achievement_badges_token_id 
    ON achievement_badges (token_id);

-- Index for awarded_at timestamp
CREATE INDEX IF NOT EXISTS idx_achievement_badges_awarded_at 
    ON achievement_badges (awarded_at);

COMMENT ON TABLE achievement_badges IS 'Stores achievement badge metadata and ownership information';
COMMENT ON COLUMN achievement_badges.id IS 'Auto-incrementing primary key';
COMMENT ON COLUMN achievement_badges.learner_addr IS 'Stellar address of the learner who earned this badge';
COMMENT ON COLUMN achievement_badges.badge_type IS 'Type of badge (e.g., first_completion, streak_30, first_scholarship_funded, top_10_leaderboard)';
COMMENT ON COLUMN achievement_badges.token_id IS 'Token ID from the AchievementBadge contract';
COMMENT ON COLUMN achievement_badges.tx_hash IS 'Transaction hash of the mint transaction';
COMMENT ON COLUMN achievement_badges.awarded_at IS 'Timestamp when the badge was awarded';
