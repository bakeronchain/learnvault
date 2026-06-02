-- ============================================================
-- Migration 003: Course content relational schema
-- ============================================================

-- Courses
CREATE TABLE IF NOT EXISTS courses (
    id              SERIAL PRIMARY KEY,
    slug            TEXT NOT NULL UNIQUE,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL,
    difficulty      TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    track           TEXT NOT NULL,
    cover_image_url TEXT,
    lrn_reward      NUMERIC(18, 7) NOT NULL DEFAULT 0,
    published_at    TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Lessons
CREATE TABLE IF NOT EXISTS lessons (
    id                  SERIAL PRIMARY KEY,
    course_id           INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    order_index         INTEGER NOT NULL,
    title               TEXT NOT NULL,
    content_markdown    TEXT NOT NULL DEFAULT '',
    estimated_minutes   INTEGER NOT NULL DEFAULT 10,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (course_id, order_index)
);

-- Milestones (on-chain linkage per lesson)
CREATE TABLE IF NOT EXISTS milestones (
    id                      SERIAL PRIMARY KEY,
    course_id               INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id               INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
    on_chain_milestone_id   INTEGER NOT NULL,
    lrn_amount              NUMERIC(18, 7) NOT NULL DEFAULT 0,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (course_id, on_chain_milestone_id)
);

-- Quizzes (one per lesson)
CREATE TABLE IF NOT EXISTS quizzes (
    id            SERIAL PRIMARY KEY,
    lesson_id     INTEGER NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
    passing_score INTEGER NOT NULL DEFAULT 70,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Quiz questions
CREATE TABLE IF NOT EXISTS quiz_questions (
    id            SERIAL PRIMARY KEY,
    quiz_id       INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    options       JSONB NOT NULL,
    correct_index INTEGER NOT NULL,
    explanation   TEXT,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lessons_course_id       ON lessons (course_id);
CREATE INDEX IF NOT EXISTS idx_milestones_course_id    ON milestones (course_id);
CREATE INDEX IF NOT EXISTS idx_milestones_lesson_id    ON milestones (lesson_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id  ON quiz_questions (quiz_id);

-- updated_at trigger function (shared)
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
