-- ============================================================
-- Migration 013: Milestone peer reviews (non-binding signals for admins)
-- ============================================================

CREATE TABLE IF NOT EXISTS milestone_peer_reviews (
    id                 SERIAL PRIMARY KEY,
    report_id          INTEGER NOT NULL REFERENCES milestone_reports(id) ON DELETE CASCADE,
    reviewer_address   TEXT NOT NULL,
    verdict            TEXT NOT NULL CHECK (verdict IN ('approve', 'reject')),
    comment            TEXT,
    lrn_awarded        NUMERIC(30, 0) NOT NULL DEFAULT 0,
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (report_id, reviewer_address)
);

CREATE INDEX IF NOT EXISTS idx_milestone_peer_reviews_report_id
    ON milestone_peer_reviews (report_id);

CREATE INDEX IF NOT EXISTS idx_milestone_peer_reviews_reviewer
    ON milestone_peer_reviews (reviewer_address);
