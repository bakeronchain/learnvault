import { Pool } from "pg"

class MockPool {
	async connect() {
		return {
			query: async () => ({ rows: [] }),
			release: () => {},
		}
	}
	async query(text: string, params?: any[]) {
		return { rows: [] }
	}
}

let activePool: any
try {
	activePool = new Pool({
		connectionString: process.env.DATABASE_URL,
		ssl:
			process.env.NODE_ENV === "production"
				? { rejectUnauthorized: false }
				: false,
	})
} catch {
	console.warn("[db] Failed to create postgres pool, using mock")
	activePool = new MockPool()
}

export const pool = activePool

export const initDb = async () => {
	try {
		if (activePool instanceof Pool) {
			const client = await activePool.connect()
			await client.query(`
                CREATE TABLE IF NOT EXISTS courses (
                    id SERIAL PRIMARY KEY,
                    slug TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
                    track TEXT NOT NULL,
                    cover_image_url TEXT,
                    lrn_reward NUMERIC(18, 7) NOT NULL DEFAULT 0,
                    published_at TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS lessons (
                    id SERIAL PRIMARY KEY,
                    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                    order_index INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    content_markdown TEXT NOT NULL DEFAULT '',
                    estimated_minutes INTEGER NOT NULL DEFAULT 10,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (course_id, order_index)
                );
                CREATE TABLE IF NOT EXISTS milestones (
                    id SERIAL PRIMARY KEY,
                    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                    lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
                    on_chain_milestone_id INTEGER NOT NULL,
                    lrn_amount NUMERIC(18, 7) NOT NULL DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (course_id, on_chain_milestone_id)
                );
                CREATE TABLE IF NOT EXISTS quizzes (
                    id SERIAL PRIMARY KEY,
                    lesson_id INTEGER NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
                    passing_score INTEGER NOT NULL DEFAULT 70,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS quiz_questions (
                    id SERIAL PRIMARY KEY,
                    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
                    question_text TEXT NOT NULL,
                    options JSONB NOT NULL,
                    correct_index INTEGER NOT NULL,
                    explanation TEXT,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_lessons_course_id ON lessons (course_id);
                CREATE INDEX IF NOT EXISTS idx_milestones_course_id ON milestones (course_id);
                CREATE INDEX IF NOT EXISTS idx_milestones_lesson_id ON milestones (lesson_id);
                CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions (quiz_id);
                CREATE OR REPLACE FUNCTION set_updated_at()
                RETURNS TRIGGER LANGUAGE plpgsql AS $$
                BEGIN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$;
                CREATE OR REPLACE TRIGGER trg_courses_updated_at
                    BEFORE UPDATE ON courses
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
                CREATE OR REPLACE TRIGGER trg_lessons_updated_at
                    BEFORE UPDATE ON lessons
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
                CREATE OR REPLACE TRIGGER trg_milestones_updated_at
                    BEFORE UPDATE ON milestones
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
                CREATE OR REPLACE TRIGGER trg_quizzes_updated_at
                    BEFORE UPDATE ON quizzes
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
                CREATE OR REPLACE TRIGGER trg_quiz_questions_updated_at
                    BEFORE UPDATE ON quiz_questions
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
                CREATE TABLE IF NOT EXISTS comments (
                    id SERIAL PRIMARY KEY,
                    proposal_id TEXT NOT NULL,
                    author_address TEXT NOT NULL,
                    parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
                    content TEXT NOT NULL,
                    upvotes INTEGER DEFAULT 0,
                    downvotes INTEGER DEFAULT 0,
                    is_pinned BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    deleted_at TIMESTAMP WITH TIME ZONE
                );
                -- Add deleted_at column if it doesn't exist (for existing tables)
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'comments' AND column_name = 'deleted_at'
                    ) THEN
                        ALTER TABLE comments ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
                    END IF;
                END $$;
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
                CREATE TABLE IF NOT EXISTS proposals (
                    id SERIAL PRIMARY KEY,
                    author_address TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    amount NUMERIC(18, 7) NOT NULL DEFAULT 0,
                    votes_for BIGINT NOT NULL DEFAULT 0,
                    votes_against BIGINT NOT NULL DEFAULT 0,
                    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
                    deadline TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_proposals_status_created_at
                    ON proposals (status, created_at DESC);
                CREATE TABLE IF NOT EXISTS votes (
                    id SERIAL PRIMARY KEY,
                    proposal_id INTEGER NOT NULL REFERENCES proposals(id),
                    voter_address TEXT NOT NULL,
                    support BOOLEAN NOT NULL,
                    voting_power NUMERIC NOT NULL,
                    tx_hash TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(proposal_id, voter_address)
                );
                CREATE INDEX IF NOT EXISTS idx_votes_proposal_id ON votes (proposal_id);
                CREATE INDEX IF NOT EXISTS idx_votes_voter_address ON votes (voter_address);
                CREATE TABLE IF NOT EXISTS platform_events (
                    id SERIAL PRIMARY KEY,
                    event_type TEXT NOT NULL,
                    data JSONB NOT NULL DEFAULT '{}'::jsonb,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_platform_events_type_created_at
                    ON platform_events (event_type, created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_platform_events_created_at
                    ON platform_events (created_at DESC);
                CREATE TABLE IF NOT EXISTS scholar_balances (
                    address TEXT PRIMARY KEY,
                    lrn_balance NUMERIC(30, 0) NOT NULL DEFAULT 0,
                    courses_completed INTEGER NOT NULL DEFAULT 0,
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_scholar_balances_lrn_desc
                    ON scholar_balances (lrn_balance DESC, address ASC);
                CREATE TABLE IF NOT EXISTS enrollments (
                    id SERIAL PRIMARY KEY,
                    learner_address TEXT NOT NULL,
                    course_id TEXT NOT NULL,
                    tx_hash TEXT NOT NULL,
                    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(learner_address, course_id)
                );
                CREATE INDEX IF NOT EXISTS idx_enrollments_learner_address ON enrollments (learner_address);
                CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments (course_id);
                CREATE TABLE IF NOT EXISTS notifications (
                    id SERIAL PRIMARY KEY,
                    recipient_address TEXT NOT NULL,
                    type TEXT NOT NULL,
                    message TEXT NOT NULL,
                    href TEXT,
                    is_read BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_notifications_recipient
                    ON notifications (recipient_address, created_at DESC);
            `)
			client.release()
			console.log("Postgres database initialized")
		} else {
			console.log("In-memory mock database initialized")
		}
	} catch (err) {
		console.error("Database initialization failed, falling back to mock")
		activePool = new MockPool()
	}
}

export const db = {
	query: (text: string, params?: any[]) => activePool.query(text, params),
	connected: true,
}
