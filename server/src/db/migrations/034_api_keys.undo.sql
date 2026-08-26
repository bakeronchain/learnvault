-- Undo migration 034: drop Open Data API key tables.

DROP TABLE IF EXISTS api_key_usage;
DROP TABLE IF EXISTS api_keys;
