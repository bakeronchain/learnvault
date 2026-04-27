-- Undo Migration 011: Multi-donor contributions
DROP TABLE IF EXISTS scholarship_contributions;

ALTER TABLE proposals DROP COLUMN IF EXISTS current_funding;
