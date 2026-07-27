-- ============================================================
-- Migration 027: Learning streaks & daily goals
-- ============================================================

-- Tracks each learner's current/longest streak and their configurable
-- daily activity goal (used to drive the streak-milestone LRN bonus).
CREATE TABLE IF NOT EXISTS learner_streaks (
  learner_address   TEXT PRIMARY KEY,
  current_streak    INTEGER NOT NULL DEFAULT 0,
  longest_streak    INTEGER NOT NULL DEFAULT 0,
  last_active_date  DATE,
  daily_goal        INTEGER NOT NULL DEFAULT 1,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per learner per day they logged milestone activity. Drives both
-- the streak calculation and the "today's progress" ring on the widget.
CREATE TABLE IF NOT EXISTS streak_activity (
  id               SERIAL PRIMARY KEY,
  learner_address  TEXT NOT NULL,
  activity_date    DATE NOT NULL,
  milestones_done  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (learner_address, activity_date)
);
