-- Rollback for 031_milestone_arbitration.sql
-- WARNING: destroys all indexed dispute/juror/vote history.

DROP TABLE IF EXISTS pending_dispute_evidence;

ALTER TABLE notification_preferences
    DROP COLUMN IF EXISTS dispute_opened,
    DROP COLUMN IF EXISTS dispute_juror_selected,
    DROP COLUMN IF EXISTS dispute_reveal_reminder,
    DROP COLUMN IF EXISTS dispute_resolved;

DROP INDEX IF EXISTS idx_dispute_votes_dispute_id;
DROP TABLE IF EXISTS dispute_votes;

DROP INDEX IF EXISTS idx_dispute_jurors_dispute_id;
DROP INDEX IF EXISTS idx_dispute_jurors_juror_address;
DROP TABLE IF EXISTS dispute_jurors;

DROP INDEX IF EXISTS idx_disputes_reveal_deadline;
DROP INDEX IF EXISTS idx_disputes_scholar_address;
DROP INDEX IF EXISTS idx_disputes_phase;
DROP TABLE IF EXISTS disputes;
