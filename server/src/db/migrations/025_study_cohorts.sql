-- ============================================================
-- Migration 025: Study cohorts (squads)
-- Small groups of learners enrolled in the same track who share
-- a group progress view, discussion thread, and leaderboard.
-- ============================================================

CREATE TABLE IF NOT EXISTS cohorts (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    course_slug   TEXT NOT NULL,
    start_date    DATE NOT NULL,
    max_members   INTEGER NOT NULL DEFAULT 8 CHECK (max_members > 0),
    created_by    TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cohort_members (
    cohort_id     INTEGER NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
    learner_addr  TEXT NOT NULL,
    joined_at     TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (cohort_id, learner_addr)
);

CREATE INDEX IF NOT EXISTS idx_cohorts_course_slug        ON cohorts (course_slug);
CREATE INDEX IF NOT EXISTS idx_cohort_members_learner     ON cohort_members (learner_addr);
