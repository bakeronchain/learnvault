-- ============================================================
-- Migration 034: Open Data API keys and usage quotas (issue #1060)
-- ============================================================
-- Public read-only API authentication. Keys are shown once at creation
-- and only ever stored as a SHA-256 hash. Usage is tracked per key per
-- endpoint per day so tier quotas can be enforced.

CREATE TABLE IF NOT EXISTS api_keys (
  id           SERIAL PRIMARY KEY,
  key_hash     TEXT NOT NULL UNIQUE,      -- store a hash, never the key itself
  label        TEXT NOT NULL,
  owner_email  TEXT,
  tier         TEXT NOT NULL DEFAULT 'free',
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS api_key_usage (
  id         SERIAL PRIMARY KEY,
  key_id     INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  day        DATE NOT NULL,
  call_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (key_id, endpoint, day)
);
