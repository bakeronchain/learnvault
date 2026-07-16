-- ============================================================
-- Migration 026: Course prerequisite path rules (for recommendations)
-- ============================================================

-- Declares the recommended learning path between courses, e.g. Soroban
-- requires Stellar Basics first. Distinct from the hard enrollment gate in
-- courses.prerequisites — this table drives recommendation scoring/gating.
CREATE TABLE IF NOT EXISTS course_prerequisites (
    course_slug   TEXT NOT NULL REFERENCES courses(slug) ON DELETE CASCADE,
    requires_slug TEXT NOT NULL REFERENCES courses(slug) ON DELETE CASCADE,
    PRIMARY KEY (course_slug, requires_slug)
);

CREATE INDEX IF NOT EXISTS idx_course_prerequisites_course_slug
    ON course_prerequisites (course_slug);
