-- Rollback for 031_translation_content_schema.sql
-- WARNING: destroys all course/lesson translation content, translator grants,
-- and glossary terms.

DROP TRIGGER IF EXISTS trg_course_glossary_terms_updated_at ON course_glossary_terms;
DROP TRIGGER IF EXISTS trg_lesson_translations_updated_at ON lesson_translations;
DROP TRIGGER IF EXISTS trg_course_translations_updated_at ON course_translations;

DROP TABLE IF EXISTS course_glossary_terms;
DROP TABLE IF EXISTS translator_grants;
DROP TABLE IF EXISTS lesson_translations;
DROP TABLE IF EXISTS course_translations;

ALTER TABLE courses DROP COLUMN IF EXISTS content_version;

DROP TYPE IF EXISTS translation_status;
