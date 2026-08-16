-- ============================================================
-- Undo Migration 025: Achievement badges table
-- ============================================================

DROP INDEX IF EXISTS idx_achievement_badges_awarded_at;
DROP INDEX IF EXISTS idx_achievement_badges_token_id;
DROP INDEX IF EXISTS idx_achievement_badges_badge_type;
DROP INDEX IF EXISTS idx_achievement_badges_learner_addr;
DROP TABLE IF EXISTS achievement_badges;
