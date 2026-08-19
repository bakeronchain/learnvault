-- Rollback for 030_sponsorship.sql
-- WARNING: destroys all sponsorship/spend-tracking history.

DROP INDEX IF EXISTS idx_sponsor_spend_log_spent_at;
DROP TABLE IF EXISTS sponsor_spend_log;

DROP INDEX IF EXISTS idx_sponsored_accounts_status;
DROP TABLE IF EXISTS sponsored_accounts;
