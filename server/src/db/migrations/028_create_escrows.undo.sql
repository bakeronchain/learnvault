-- Undo migration 028: Drop escrows table

DROP INDEX IF EXISTS idx_escrows_proposal_id;
DROP INDEX IF EXISTS idx_escrows_scholar_address;
DROP TABLE IF EXISTS escrows;
