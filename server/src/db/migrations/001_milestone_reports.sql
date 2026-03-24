-- Milestone reports submitted by scholars
CREATE TABLE IF NOT EXISTS milestone_reports (
    id SERIAL PRIMARY KEY,
    scholar_address TEXT NOT NULL,
    course_id TEXT NOT NULL,
    milestone_id INTEGER NOT NULL,
    evidence_github TEXT,
    evidence_ipfs_cid TEXT,
    evidence_description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(scholar_address, course_id, milestone_id)
);

-- Audit log for every validator decision
CREATE TABLE IF NOT EXISTS milestone_audit_log (
    id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL REFERENCES milestone_reports(id) ON DELETE CASCADE,
    validator_address TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
    rejection_reason TEXT,
    contract_tx_hash TEXT,
    decided_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
