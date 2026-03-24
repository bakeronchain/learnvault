export type DbClient = {
	connected: boolean
}

export const db: DbClient = {
	connected: false,
}

export const pool = activePool;

export const initDb = async () => {
    try {
        if (activePool instanceof Pool) {
            const client = await activePool.connect();
            await client.query(`
                CREATE TABLE IF NOT EXISTS comments (
                    id SERIAL PRIMARY KEY,
                    proposal_id TEXT NOT NULL,
                    author_address TEXT NOT NULL,
                    parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
                    content TEXT NOT NULL,
                    upvotes INTEGER DEFAULT 0,
                    downvotes INTEGER DEFAULT 0,
                    is_pinned BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS comment_votes (
                    id SERIAL PRIMARY KEY,
                    comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
                    voter_address TEXT NOT NULL,
                    vote_type TEXT CHECK (vote_type IN ('upvote', 'downvote')),
                    UNIQUE(comment_id, voter_address)
                );
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
                CREATE TABLE IF NOT EXISTS milestone_audit_log (
                    id SERIAL PRIMARY KEY,
                    report_id INTEGER NOT NULL REFERENCES milestone_reports(id) ON DELETE CASCADE,
                    validator_address TEXT NOT NULL,
                    decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
                    rejection_reason TEXT,
                    contract_tx_hash TEXT,
                    decided_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS ipfs_uploads (
                    id SERIAL PRIMARY KEY,
                    uploader_address TEXT NOT NULL,
                    cid TEXT NOT NULL UNIQUE,
                    gateway_url TEXT NOT NULL,
                    original_filename TEXT NOT NULL,
                    mimetype TEXT NOT NULL,
                    context TEXT,
                    ref_id TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS course_assets (
                    course_id TEXT NOT NULL,
                    asset_type TEXT NOT NULL DEFAULT 'cover_image',
                    cid TEXT NOT NULL,
                    gateway_url TEXT NOT NULL,
                    uploaded_by TEXT NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (course_id, asset_type)
                );
                CREATE TABLE IF NOT EXISTS proposal_documents (
                    id SERIAL PRIMARY KEY,
                    proposal_id TEXT NOT NULL,
                    uploader_address TEXT NOT NULL,
                    cid TEXT NOT NULL,
                    gateway_url TEXT NOT NULL,
                    original_filename TEXT NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            `);
            client.release();
            console.log("Postgres database initialized");
        } else {
            console.log("In-memory mock database initialized");
        }
    } catch (err) {
        console.error("Database initialization failed, falling back to mock");
        activePool = new MockPool();
    }
};

export const db = {
  query: (text: string, params?: any[]) => activePool.query(text, params),
  connected: true
};
