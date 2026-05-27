import { type Request } from "express"
import { pool } from "../db/index"

export type AdminAuditEvent = {
	actorAddress?: string | null
	authMethod: "jwt" | "api_key"
	operation: string
	targetType: string
	targetId?: string | null
	outcome: "success" | "failure"
	requestId?: string | null
	ipAddress?: string | null
	metadata?: Record<string, unknown> | null
}

export async function recordAdminAuditEvent(
	event: AdminAuditEvent,
): Promise<void> {
	try {
		await pool.query(
			`INSERT INTO admin_operation_audit_log
				(actor_address, auth_method, operation, target_type, target_id, outcome, request_id, ip_address, metadata)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			[
				event.actorAddress ?? null,
				event.authMethod,
				event.operation,
				event.targetType,
				event.targetId ?? null,
				event.outcome,
				event.requestId ?? null,
				event.ipAddress ?? null,
				event.metadata ? JSON.stringify(event.metadata) : null,
			],
		)
	} catch (error) {
		console.warn("[admin-audit] Failed to persist audit event:", error)
	}
}

export function getRequestIp(req: Request): string | null {
	return req.ip || req.socket.remoteAddress || null
}
