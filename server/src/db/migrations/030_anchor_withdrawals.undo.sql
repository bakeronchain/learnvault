-- Rollback for 030_anchor_withdrawals.sql
-- WARNING: destroys all recorded anchor cash-out withdrawal history.

DROP INDEX IF EXISTS idx_anchor_withdrawals_status;
DROP INDEX IF EXISTS idx_anchor_withdrawals_learner_addr;
DROP TABLE IF EXISTS anchor_withdrawals;
