-- Rollback for 031_treasury_deposits.sql
-- WARNING: destroys all treasury deposit history.

DROP INDEX IF EXISTS idx_treasury_deposits_donor_created;
DROP TABLE IF EXISTS treasury_deposits;
