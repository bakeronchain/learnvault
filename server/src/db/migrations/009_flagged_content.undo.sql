-- ============================================================
-- Migration 009 Undo: Content moderation and flagging system
-- ============================================================

DROP INDEX IF EXISTS idx_flag_audit_log_flagged_id;
DROP TABLE IF EXISTS flag_audit_log;

DROP INDEX IF EXISTS idx_flagged_content_hidden;
DROP INDEX IF EXISTS idx_flagged_content_status_created_at;
DROP TABLE IF EXISTS flagged_content;
