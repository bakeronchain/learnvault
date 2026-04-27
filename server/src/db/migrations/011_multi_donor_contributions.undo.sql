ALTER TABLE proposals DROP COLUMN IF EXISTS current_funding;

DROP TABLE IF EXISTS scholarship_contributions CASCADE;
