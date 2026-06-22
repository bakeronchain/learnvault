ALTER TABLE milestone_reports
    DROP COLUMN IF EXISTS oracle_verified,
    DROP COLUMN IF EXISTS oracle_evidence_hash,
    DROP COLUMN IF EXISTS oracle_checked_at,
    DROP COLUMN IF EXISTS oracle_detail;
