DROP TRIGGER IF EXISTS trg_escrow_timeouts_updated_at ON escrow_timeouts;
DROP FUNCTION IF EXISTS set_escrow_timeouts_updated_at;
DROP INDEX IF EXISTS idx_escrow_timeouts_scholar_course;
DROP INDEX IF EXISTS idx_escrow_timeouts_status_last_activity;
DROP TABLE IF EXISTS escrow_timeouts;
