-- ============================================================
-- Migration 031: Course and lesson content translations
-- ============================================================
-- Backs the multilingual course content feature: English rows in
-- `courses`/`lessons` stay canonical and are never migrated here.
-- `course_translations`/`lesson_translations` hold per-language
-- draft/in_review/published copies, flagged stale (never deleted) when
-- the English source they were translated from moves on.
--
-- lesson_translations keys off (course_id, order_index), not lesson_id:
-- lessons are versioned by inserting a new row on every edit
-- (016_lesson_content_versioning.sql sets the old row is_active=false and
-- gives the new version a new id), so a translation FK'd to a specific
-- lessons.id would orphan itself on the next edit. (course_id, order_index)
-- is the stable identity of "this lesson" across versions.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'translation_status') THEN
        CREATE TYPE translation_status AS ENUM ('draft', 'in_review', 'published');
    END IF;
END $$;

ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS content_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS course_translations (
    id                   SERIAL PRIMARY KEY,
    course_id            INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    language_code        TEXT NOT NULL CHECK (language_code IN ('es', 'fr', 'sw')),
    title                TEXT NOT NULL,
    description          TEXT NOT NULL,
    status               translation_status NOT NULL DEFAULT 'draft',
    translator_address   TEXT NOT NULL,
    reviewed_by_address  TEXT,
    source_version       INTEGER NOT NULL, -- courses.content_version this was translated from
    is_stale             BOOLEAN NOT NULL DEFAULT FALSE,
    published_at         TIMESTAMP WITH TIME ZONE,
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (course_id, language_code)
);

CREATE TABLE IF NOT EXISTS lesson_translations (
    id                   SERIAL PRIMARY KEY,
    course_id            INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    order_index          INTEGER NOT NULL,
    language_code        TEXT NOT NULL CHECK (language_code IN ('es', 'fr', 'sw')),
    title                TEXT NOT NULL,
    content_markdown     TEXT NOT NULL,
    status               translation_status NOT NULL DEFAULT 'draft',
    translator_address   TEXT NOT NULL,
    reviewed_by_address  TEXT,
    source_version       INTEGER NOT NULL, -- lessons.version this was translated from
    is_stale             BOOLEAN NOT NULL DEFAULT FALSE,
    published_at         TIMESTAMP WITH TIME ZONE,
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (course_id, order_index, language_code)
);

CREATE INDEX IF NOT EXISTS idx_course_translations_lang_status
    ON course_translations (language_code, status);
CREATE INDEX IF NOT EXISTS idx_lesson_translations_course_lang_status
    ON lesson_translations (course_id, language_code, status);

-- Per-language translator grants. Auth in this codebase is wallet-address +
-- JWT-claim based (no `users` table exists), so grants are keyed on the
-- wallet address, same identity the rest of the API already trusts.
CREATE TABLE IF NOT EXISTS translator_grants (
    id             SERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    language_code  TEXT NOT NULL CHECK (language_code IN ('es', 'fr', 'sw')),
    granted_by     TEXT NOT NULL,
    granted_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at     TIMESTAMP WITH TIME ZONE,
    UNIQUE (wallet_address, language_code)
);

-- Per-course do-not-translate glossary (protocol nouns like LRN, Soroban,
-- Stellar, escrow, wallet, testnet) surfaced inline in the translator editor.
CREATE TABLE IF NOT EXISTS course_glossary_terms (
    id         SERIAL PRIMARY KEY,
    course_id  INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    term       TEXT NOT NULL,
    note       TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (course_id, term)
);

CREATE OR REPLACE TRIGGER trg_course_translations_updated_at
    BEFORE UPDATE ON course_translations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_lesson_translations_updated_at
    BEFORE UPDATE ON lesson_translations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_course_glossary_terms_updated_at
    BEFORE UPDATE ON course_glossary_terms
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
