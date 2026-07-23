-- Migration 028: Create escrows table

CREATE TABLE IF NOT EXISTS escrows (
  id                 SERIAL PRIMARY KEY,
  proposal_id        INTEGER NOT NULL REFERENCES proposals(id),
  scholar_address    TEXT NOT NULL,
  total_amount       NUMERIC NOT NULL,
  tranches           INTEGER NOT NULL DEFAULT 3,
  tranches_released  INTEGER NOT NULL DEFAULT 0,
  contract_escrow_id INTEGER NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrows_proposal_id ON escrows (proposal_id);
CREATE INDEX IF NOT EXISTS idx_escrows_scholar_address ON escrows (scholar_address);
