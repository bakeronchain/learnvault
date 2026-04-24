CREATE TABLE IF NOT EXISTS scholarship_contributions (
    id SERIAL PRIMARY KEY,
    proposal_id INTEGER REFERENCES proposals(id) ON DELETE CASCADE,
    donor_address VARCHAR(56) NOT NULL,
    amount NUMERIC(20, 7) NOT NULL,
    tx_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add a column to proposals to track current funding if not exists
DO server/src/db/migrations/011_multi_donor_contributions.sql 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='proposals' AND COLUMN_NAME='current_funding') THEN
        ALTER TABLE proposals ADD COLUMN current_funding NUMERIC(20, 7) DEFAULT 0;
    END IF;
END server/src/db/migrations/011_multi_donor_contributions.sql;
