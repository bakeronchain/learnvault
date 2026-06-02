-- Extend milestone_reports.status to include appeal states
ALTER TABLE milestone_reports
    DROP CONSTRAINT IF EXISTS milestone_reports_status_check;

ALTER TABLE milestone_reports
    ADD CONSTRAINT milestone_reports_status_check
        CHECK (status IN ('pending', 'approved', 'rejected', 'appealed', 'final_rejected'));

-- Appeal fields on the report itself
ALTER TABLE milestone_reports
    ADD COLUMN IF NOT EXISTS appeal_reason          TEXT,
    ADD COLUMN IF NOT EXISTS appeal_submitted_at    TIMESTAMP WITH TIME ZONE;

-- Extend audit log decision to include appeal outcomes
ALTER TABLE milestone_audit_log
    DROP CONSTRAINT IF EXISTS milestone_audit_log_decision_check;

ALTER TABLE milestone_audit_log
    ADD CONSTRAINT milestone_audit_log_decision_check
        CHECK (decision IN ('approved', 'rejected', 'appeal_approved', 'appeal_rejected'));

CREATE INDEX IF NOT EXISTS idx_milestone_reports_appealed
    ON milestone_reports (status)
    WHERE status = 'appealed';
