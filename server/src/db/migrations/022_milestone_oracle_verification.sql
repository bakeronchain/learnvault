-- Oracle (GitHub proof-of-work) verification results for milestone reports.
-- Populated automatically when a learner submits a GitHub PR as evidence and
-- re-checked during admin approval to gate the on-chain milestone/escrow release.
ALTER TABLE milestone_reports
    ADD COLUMN IF NOT EXISTS oracle_verified      BOOLEAN,
    ADD COLUMN IF NOT EXISTS oracle_evidence_hash TEXT,
    ADD COLUMN IF NOT EXISTS oracle_checked_at    TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS oracle_detail        JSONB;
