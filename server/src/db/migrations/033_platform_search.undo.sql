-- Undo migration 033: drop generated search vectors and their GIN indexes.

DROP INDEX IF EXISTS idx_user_profiles_search;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS search_vector;

DROP INDEX IF EXISTS idx_forum_threads_search;
ALTER TABLE forum_threads DROP COLUMN IF EXISTS search_vector;

DROP INDEX IF EXISTS idx_wiki_pages_search;
ALTER TABLE wiki_pages DROP COLUMN IF EXISTS search_vector;

DROP INDEX IF EXISTS idx_lessons_search;
ALTER TABLE lessons DROP COLUMN IF EXISTS search_vector;

DROP INDEX IF EXISTS idx_courses_search;
ALTER TABLE courses DROP COLUMN IF EXISTS search_vector;
