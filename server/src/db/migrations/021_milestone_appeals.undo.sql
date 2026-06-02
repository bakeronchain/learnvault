ALTER TABLE milestone_reports
    DROP COLUMN IF EXISTS appeal_reason,
    DROP COLUMN IF EXISTS appeal_submitted_at;

ALTER TABLE milestone_reports
    DROP CONSTRAINT IF EXISTS milestone_reports_status_check;

ALTER TABLE milestone_reports
    ADD CONSTRAINT milestone_reports_status_check
        CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE milestone_audit_log
    DROP CONSTRAINT IF EXISTS milestone_audit_log_decision_check;

ALTER TABLE milestone_audit_log
    ADD CONSTRAINT milestone_audit_log_decision_check
        CHECK (decision IN ('approved', 'rejected'));

DROP INDEX IF EXISTS idx_milestone_reports_appealed;
