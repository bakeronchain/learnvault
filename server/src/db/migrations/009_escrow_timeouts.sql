-- ============================================================
-- Migration 009: Escrow timeout tracking and reminders
-- ============================================================

CREATE TABLE IF NOT EXISTS escrow_timeouts (
    id                      SERIAL PRIMARY KEY,
    proposal_id             INTEGER NOT NULL UNIQUE REFERENCES proposals(id) ON DELETE CASCADE,
    scholar_address         TEXT NOT NULL,
    scholar_email           TEXT,
    course_id               TEXT,
    inactivity_window_days  INTEGER NOT NULL DEFAULT 30,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reclaimed')),
    reminder_sent_at        TIMESTAMP WITH TIME ZONE,
    reclaimed_at            TIMESTAMP WITH TIME ZONE,
    last_check_at           TIMESTAMP WITH TIME ZONE,
    reclaim_tx_hash         TEXT,
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_escrow_timeouts_status_last_activity
    ON escrow_timeouts (status, last_activity_at ASC);

CREATE INDEX IF NOT EXISTS idx_escrow_timeouts_scholar_course
    ON escrow_timeouts (scholar_address, course_id);

CREATE OR REPLACE FUNCTION set_escrow_timeouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_escrow_timeouts_updated_at ON escrow_timeouts;
CREATE TRIGGER trg_escrow_timeouts_updated_at
    BEFORE UPDATE ON escrow_timeouts
    FOR EACH ROW
    EXECUTE FUNCTION set_escrow_timeouts_updated_at();
