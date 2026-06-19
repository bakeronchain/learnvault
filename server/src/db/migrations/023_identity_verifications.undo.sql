-- ============================================================
-- Undo Migration 023: Drop identity verifications table
-- ============================================================

DROP TRIGGER IF EXISTS trg_identity_verifications_updated_at ON identity_verifications;
DROP FUNCTION IF EXISTS set_identity_verifications_updated_at();
DROP INDEX IF EXISTS idx_identity_verifications_status;
DROP INDEX IF EXISTS idx_identity_verifications_wallet;
DROP TABLE IF EXISTS identity_verifications;
