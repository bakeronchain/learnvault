/*
  Migration: 019_proposal_amendments.sql
  Adds a table to store amendment history for scholarship proposals.
*/
CREATE TABLE proposal_amendments (
    id SERIAL PRIMARY KEY,
    proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    author_address VARCHAR(56) NOT NULL,
    previous_data JSONB NOT NULL,
    updated_data JSONB NOT NULL,
    amendment_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups by proposal_id
CREATE INDEX idx_proposal_amendments_proposal_id ON proposal_amendments(proposal_id);
