CREATE TABLE IF NOT EXISTS scholarship_contributions (
    id SERIAL PRIMARY KEY,
    proposal_id INTEGER REFERENCES proposals(id) ON DELETE CASCADE,
    donor_address VARCHAR(56) NOT NULL,
    amount NUMERIC(20, 7) NOT NULL,
    tx_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add a column to proposals to track current funding if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'proposals'
          AND column_name = 'current_funding'
    ) THEN
        ALTER TABLE proposals ADD COLUMN current_funding NUMERIC(20, 7) DEFAULT 0;
    END IF;
END $$;
