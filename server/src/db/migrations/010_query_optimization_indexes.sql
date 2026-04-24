-- ============================================================
-- Migration 010: Query optimization indexes
-- ============================================================

-- Milestone report listing and filtering
CREATE INDEX IF NOT EXISTS idx_milestone_reports_scholar_status_submitted
    ON milestone_reports (scholar_address, status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_milestone_reports_course_status_submitted
    ON milestone_reports (course_id, status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_milestone_reports_status_submitted
    ON milestone_reports (status, submitted_at DESC);

-- Fetch latest audit decision per report efficiently
CREATE INDEX IF NOT EXISTS idx_milestone_audit_report_decided_at
    ON milestone_audit_log (report_id, decided_at DESC);

-- Governance proposal listings and status checks
CREATE INDEX IF NOT EXISTS idx_proposals_created_at
    ON proposals (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_proposals_cancelled_status_deadline
    ON proposals (cancelled, status, deadline);

-- Comment feed loading by proposal
CREATE INDEX IF NOT EXISTS idx_comments_proposal_created_at
    ON comments (proposal_id, created_at DESC);

-- Event feed filters by contract and recency
CREATE INDEX IF NOT EXISTS idx_events_contract_created_at
    ON events (contract, created_at DESC);

-- Enrollments query by learner ordered by most recent
CREATE INDEX IF NOT EXISTS idx_enrollments_learner_enrolled_at
    ON enrollments (learner_address, enrolled_at DESC);
