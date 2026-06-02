-- ============================================================
-- Migration 007: Votes, enrollments, and platform events
-- ============================================================

-- Votes on governance proposals
CREATE TABLE IF NOT EXISTS votes (
    id             SERIAL PRIMARY KEY,
    proposal_id    INTEGER NOT NULL REFERENCES proposals(id),
    voter_address  TEXT NOT NULL,
    support        BOOLEAN NOT NULL,
    voting_power   NUMERIC NOT NULL,
    tx_hash        TEXT,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(proposal_id, voter_address)
);

CREATE INDEX IF NOT EXISTS idx_votes_proposal_id    ON votes (proposal_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_address  ON votes (voter_address);

-- Course enrollments
CREATE TABLE IF NOT EXISTS enrollments (
    id               SERIAL PRIMARY KEY,
    learner_address  TEXT NOT NULL,
    course_id        TEXT NOT NULL,
    tx_hash          TEXT NOT NULL,
    enrolled_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(learner_address, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_learner_address ON enrollments (learner_address);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id       ON enrollments (course_id);

-- Platform-wide event log (activity feed, analytics)
CREATE TABLE IF NOT EXISTS platform_events (
    id          SERIAL PRIMARY KEY,
    event_type  TEXT NOT NULL,
    data        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_events_type_created_at
    ON platform_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_events_created_at
    ON platform_events (created_at DESC);
