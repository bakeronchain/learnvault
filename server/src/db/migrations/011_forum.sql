-- ============================================================
-- Migration 011: Forum Threads and Replies
-- ============================================================

CREATE TABLE IF NOT EXISTS forum_threads (
    id SERIAL PRIMARY KEY,
    course_id TEXT NOT NULL,
    author_address TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_forum_threads_course_id ON forum_threads (course_id);

CREATE TABLE IF NOT EXISTS forum_replies (
    id SERIAL PRIMARY KEY,
    thread_id INTEGER NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
    author_address TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_forum_replies_thread_id ON forum_replies (thread_id);

CREATE OR REPLACE TRIGGER trg_forum_threads_updated_at
    BEFORE UPDATE ON forum_threads
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_forum_replies_updated_at
    BEFORE UPDATE ON forum_replies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
