-- ============================================================
-- Migration 011: Course bookmarks / wishlist
-- ============================================================

-- Bookmarks let a learner save courses for later without enrolling.
CREATE TABLE IF NOT EXISTS bookmarks (
    id          SERIAL PRIMARY KEY,
    address     TEXT NOT NULL,
    course_id   TEXT NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(address, course_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_address   ON bookmarks (address);
CREATE INDEX IF NOT EXISTS idx_bookmarks_course_id ON bookmarks (course_id);
