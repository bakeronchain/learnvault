DROP TRIGGER IF EXISTS trg_forum_replies_updated_at ON forum_replies;
DROP TRIGGER IF EXISTS trg_forum_threads_updated_at ON forum_threads;

DROP TABLE IF EXISTS forum_replies CASCADE;
DROP TABLE IF EXISTS forum_threads CASCADE;
