-- ============================================================
-- Undo Migration 021: Third-party provider integration API
-- ============================================================

DROP TABLE IF EXISTS provider_webhook_deliveries;
DROP TABLE IF EXISTS provider_webhooks;
DROP TABLE IF EXISTS provider_completions;
ALTER TABLE courses DROP COLUMN IF EXISTS provider_key_id;
ALTER TABLE courses DROP COLUMN IF EXISTS external_url;
DROP TABLE IF EXISTS provider_api_keys;
