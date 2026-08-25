-- ============================================================
-- Migration 033: Platform-wide full-text search (issue #1079)
-- ============================================================
-- Generated tsvector columns over the searchable content tables, weighted
-- title (A) > summary/description (B) > body (C). GIN indexes make ranking
-- queries fast; BEFORE INSERT OR UPDATE triggers keep the vectors in sync
-- with the source rows so the index can never silently drift.

-- ── courses ──────────────────────────────────────────────────────────────
ALTER TABLE courses ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B')
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_courses_search ON courses USING GIN (search_vector);

-- ── lessons ──────────────────────────────────────────────────────────────
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(content_markdown, '')), 'C')
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_lessons_search ON lessons USING GIN (search_vector);

-- ── wiki_pages ───────────────────────────────────────────────────────────
ALTER TABLE wiki_pages ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'C')
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_wiki_pages_search ON wiki_pages USING GIN (search_vector);

-- ── forum_threads ────────────────────────────────────────────────────────
ALTER TABLE forum_threads ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'C')
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_forum_threads_search ON forum_threads USING GIN (search_vector);

-- ── user_profiles (public scholar profiles) ─────────────────────────────
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(display_name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(bio, '')), 'C')
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_user_profiles_search ON user_profiles USING GIN (search_vector);
