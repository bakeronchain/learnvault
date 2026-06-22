-- ============================================================
-- Migration 022: Community events table
-- Stores hackathons, study groups, and workshops created by
-- community managers via POST /api/community/events.
-- ============================================================

CREATE TABLE IF NOT EXISTS community_events (
    id          SERIAL PRIMARY KEY,
    title       TEXT        NOT NULL,
    description TEXT        NOT NULL,
    date        TIMESTAMPTZ NOT NULL,
    type        TEXT        NOT NULL CHECK (type IN ('hackathon', 'study_group', 'workshop')),
    link        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Supports filtering by event type — O(log n) index scan
CREATE INDEX IF NOT EXISTS idx_community_events_type
    ON community_events (type);

-- Supports chronological ordering of upcoming events — O(log n) index scan
CREATE INDEX IF NOT EXISTS idx_community_events_date
    ON community_events (date ASC);

COMMENT ON TABLE community_events IS 'Community-organised events: hackathons, study groups, and workshops';
COMMENT ON COLUMN community_events.type IS 'Event category: hackathon | study_group | workshop';
COMMENT ON COLUMN community_events.date IS 'Scheduled start time of the event (timezone-aware)';
