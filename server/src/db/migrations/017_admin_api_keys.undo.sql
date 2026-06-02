-- ============================================================
-- Undo Migration 017: Admin API key rotation system
-- ============================================================

DROP INDEX IF EXISTS idx_admin_key_rotation_history_address;
DROP INDEX IF EXISTS idx_admin_api_keys_hash;
DROP INDEX IF EXISTS idx_admin_api_keys_admin_address;

DROP TABLE IF EXISTS admin_key_rotation_history;
DROP TABLE IF EXISTS admin_api_keys;
