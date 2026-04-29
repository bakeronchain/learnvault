DROP INDEX IF EXISTS idx_enrollments_course_version;
ALTER TABLE enrollments DROP COLUMN IF EXISTS content_version;

DROP INDEX IF EXISTS idx_lessons_course_version;
DROP INDEX IF EXISTS idx_lessons_course_order_active_unique;
DROP INDEX IF EXISTS idx_lessons_course_order_version_unique;

ALTER TABLE lessons
    DROP COLUMN IF EXISTS change_summary,
    DROP COLUMN IF EXISTS superseded_by,
    DROP COLUMN IF EXISTS superseded_at,
    DROP COLUMN IF EXISTS is_active,
    DROP COLUMN IF EXISTS version;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'lessons_course_id_order_index_key'
    ) THEN
        ALTER TABLE lessons
            ADD CONSTRAINT lessons_course_id_order_index_key UNIQUE (course_id, order_index);
    END IF;
END $$;
