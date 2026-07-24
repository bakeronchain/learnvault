-- ============================================================
-- Migration 025: Mentor booking & escrow-paid 1:1 sessions
-- ============================================================
-- Replaces the old mentorship stub (migration 020) with a full
-- booking + escrow model.  The old tables are dropped first so
-- the new schema is self-contained.
-- ============================================================

DROP TABLE IF EXISTS mentorship_requests;
DROP TABLE IF EXISTS mentor_profiles;

CREATE TABLE IF NOT EXISTS mentors (
  address        TEXT PRIMARY KEY,
  bio            TEXT,
  hourly_rate    NUMERIC NOT NULL,
  skills         TEXT[] NOT NULL DEFAULT '{}',
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mentor_availability (
  id           SERIAL PRIMARY KEY,
  mentor_addr  TEXT NOT NULL REFERENCES mentors(address) ON DELETE CASCADE,
  start_ts     TIMESTAMPTZ NOT NULL,
  end_ts       TIMESTAMPTZ NOT NULL,
  booked       BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS mentor_bookings (
  id            SERIAL PRIMARY KEY,
  slot_id       INTEGER NOT NULL REFERENCES mentor_availability(id),
  learner_addr  TEXT NOT NULL,
  mentor_addr   TEXT NOT NULL,
  amount_usdc   NUMERIC NOT NULL,
  escrow_tx     TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for listing active mentors by skill
CREATE INDEX IF NOT EXISTS idx_mentors_active_skills
  ON mentors USING GIN (skills) WHERE active = true;

-- Index for finding open slots for a mentor
CREATE INDEX IF NOT EXISTS idx_availability_mentor_booked
  ON mentor_availability (mentor_addr, booked);

-- Index for looking up bookings by learner or mentor
CREATE INDEX IF NOT EXISTS idx_bookings_learner
  ON mentor_bookings (learner_addr);
CREATE INDEX IF NOT EXISTS idx_bookings_mentor
  ON mentor_bookings (mentor_addr);
