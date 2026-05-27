CREATE TABLE IF NOT EXISTS admin_api_key_state (
	id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
	current_key_hash TEXT NOT NULL,
	previous_key_hash TEXT,
	previous_key_expires_at TIMESTAMPTZ,
	rotated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	rotated_by TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_operation_audit_log (
	id BIGSERIAL PRIMARY KEY,
	actor_address TEXT,
	auth_method TEXT NOT NULL,
	operation TEXT NOT NULL,
	target_type TEXT NOT NULL,
	target_id TEXT,
	outcome TEXT NOT NULL,
	request_id TEXT,
	ip_address TEXT,
	metadata JSONB,
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_operation_audit_log_created_at
	ON admin_operation_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_operation_audit_log_operation
	ON admin_operation_audit_log (operation);
