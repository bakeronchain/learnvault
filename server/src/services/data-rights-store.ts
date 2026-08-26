import { pool } from "../db"
import { DATA_RELATIONS, type DataRelation } from "./data-rights-policy"

export type ExportStatus = "pending" | "processing" | "ready" | "failed"

export interface ExportJob {
	id: string
	walletAddress: string
	status: ExportStatus
	archive: Buffer | null
	expiresAt: Date | null
	createdAt: Date
}

export interface ClaimedDeletion {
	id: string
	walletAddress: string
}

export interface DataRightsStore {
	createExportJob(walletAddress: string): Promise<ExportJob>
	getExportJob(id: string): Promise<ExportJob | null>
	claimPendingExport(): Promise<ExportJob | null>
	completeExportJob(id: string, archive: Buffer, expiresAt: Date): Promise<void>
	failExportJob(id: string, reason: string): Promise<void>
	readRows(relation: DataRelation, walletAddress: string): Promise<unknown[]>
	findContactEmail(walletAddress: string): Promise<string | null>
	scheduleDeletion(walletAddress: string, eraseAfter: Date): Promise<void>
	getPendingDeletion(
		walletAddress: string,
	): Promise<{ eraseAfter: Date } | null>
	cancelDeletion(walletAddress: string): Promise<void>
	claimExpiredDeletion(): Promise<ClaimedDeletion | null>
	hardDelete(
		relations: readonly DataRelation[],
		walletAddress: string,
		anonymousAddress: string,
		deletionId: string,
		addressHash: string,
	): Promise<void>
}

function quoteIdentifier(value: string): string {
	if (!/^[a-z][a-z0-9_]*$/.test(value)) {
		throw new Error("Unsafe database identifier")
	}
	return `"${value}"`
}

function mapExportJob(row: Record<string, unknown>): ExportJob {
	return {
		id: String(row.id),
		walletAddress: String(row.wallet_address),
		status: row.status as ExportStatus,
		archive: Buffer.isBuffer(row.archive) ? row.archive : null,
		expiresAt: row.download_expires_at
			? new Date(String(row.download_expires_at))
			: null,
		createdAt: new Date(String(row.created_at)),
	}
}

async function resolveColumns(relation: DataRelation): Promise<string[]> {
	const result = await pool.query<{ column_name: string }>(
		`SELECT column_name
		 FROM information_schema.columns
		 WHERE table_schema = current_schema()
		   AND table_name = $1
		   AND column_name = ANY($2::text[])`,
		[relation.table, relation.identifiers],
	)
	return result.rows.map((row) => row.column_name)
}

function addressPredicate(columns: string[]): string {
	return columns.map((column) => `${quoteIdentifier(column)} = $1`).join(" OR ")
}

export function createPostgresDataRightsStore(): DataRightsStore {
	return {
		async createExportJob(walletAddress) {
			const result = await pool.query(
				`INSERT INTO learner_data_exports (wallet_address)
				 VALUES ($1)
				 RETURNING *`,
				[walletAddress],
			)
			return mapExportJob(result.rows[0])
		},

		async getExportJob(id) {
			const result = await pool.query(
				"SELECT * FROM learner_data_exports WHERE id = $1",
				[id],
			)
			return result.rows[0] ? mapExportJob(result.rows[0]) : null
		},

		async claimPendingExport() {
			const result = await pool.query(
				`UPDATE learner_data_exports
				 SET status = 'processing', updated_at = NOW()
				 WHERE id = (
				   SELECT id FROM learner_data_exports
				   WHERE status = 'pending'
				   ORDER BY created_at
				   FOR UPDATE SKIP LOCKED LIMIT 1
				 )
				 RETURNING *`,
			)
			return result.rows[0] ? mapExportJob(result.rows[0]) : null
		},

		async completeExportJob(id, archive, expiresAt) {
			await pool.query(
				`UPDATE learner_data_exports
				 SET status = 'ready', archive = $2, download_expires_at = $3,
				     error_message = NULL, updated_at = NOW()
				 WHERE id = $1`,
				[id, archive, expiresAt],
			)
		},

		async failExportJob(id, reason) {
			await pool.query(
				`UPDATE learner_data_exports
				 SET status = 'failed', error_message = $2, updated_at = NOW()
				 WHERE id = $1`,
				[id, reason.slice(0, 500)],
			)
		},

		async readRows(relation, walletAddress) {
			const columns = await resolveColumns(relation)
			if (columns.length === 0) return []
			const result = await pool.query(
				`SELECT * FROM ${quoteIdentifier(relation.table)}
				 WHERE ${addressPredicate(columns)}`,
				[walletAddress],
			)
			return result.rows
		},

		async findContactEmail(walletAddress) {
			const result = await pool.query<{ scholar_email: string }>(
				`SELECT scholar_email FROM escrow_timeouts
				 WHERE scholar_address = $1 AND scholar_email IS NOT NULL
				 ORDER BY created_at DESC LIMIT 1`,
				[walletAddress],
			)
			return result.rows[0]?.scholar_email ?? null
		},

		async scheduleDeletion(walletAddress, eraseAfter) {
			await pool.query(
				`INSERT INTO account_deletion_requests (wallet_address, erase_after)
				 VALUES ($1, $2)
				 ON CONFLICT (wallet_address) DO UPDATE
				 SET status = 'pending', erase_after = EXCLUDED.erase_after,
				     cancelled_at = NULL, updated_at = NOW()`,
				[walletAddress, eraseAfter],
			)
		},

		async getPendingDeletion(walletAddress) {
			const result = await pool.query<{ erase_after: Date }>(
				`SELECT erase_after FROM account_deletion_requests
				 WHERE wallet_address = $1 AND status = 'pending'`,
				[walletAddress],
			)
			return result.rows[0]
				? { eraseAfter: new Date(result.rows[0].erase_after) }
				: null
		},

		async cancelDeletion(walletAddress) {
			await pool.query(
				`UPDATE account_deletion_requests
				 SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
				 WHERE wallet_address = $1 AND status = 'pending'`,
				[walletAddress],
			)
		},

		async claimExpiredDeletion() {
			const result = await pool.query(
				`UPDATE account_deletion_requests
				 SET status = 'processing', updated_at = NOW()
				 WHERE id = (
				   SELECT id FROM account_deletion_requests
				   WHERE status = 'pending' AND erase_after <= NOW()
				   ORDER BY erase_after
				   FOR UPDATE SKIP LOCKED LIMIT 1
				 )
				 RETURNING id, wallet_address`,
			)
			return result.rows[0]
				? {
						id: String(result.rows[0].id),
						walletAddress: String(result.rows[0].wallet_address),
					}
				: null
		},

		async hardDelete(
			relations,
			walletAddress,
			anonymousAddress,
			deletionId,
			addressHash,
		) {
			const client = await pool.connect()
			await client.query("BEGIN")
			try {
				for (const relation of relations) {
					const columnResult = await client.query<{ column_name: string }>(
						`SELECT column_name
						 FROM information_schema.columns
						 WHERE table_schema = current_schema()
						   AND table_name = $1
						   AND column_name = ANY($2::text[])`,
						[relation.table, relation.identifiers],
					)
					const columns = columnResult.rows.map((row) => row.column_name)
					if (columns.length === 0) continue
					if (relation.deletion === "erase") {
						await client.query(
							`DELETE FROM ${quoteIdentifier(relation.table)}
							 WHERE ${addressPredicate(columns)}`,
							[walletAddress],
						)
						continue
					}
					const assignments = columns
						.map(
							(column) =>
								`${quoteIdentifier(column)} = CASE WHEN ${quoteIdentifier(column)} = $1 THEN $2 ELSE ${quoteIdentifier(column)} END`,
						)
						.join(", ")
					await client.query(
						`UPDATE ${quoteIdentifier(relation.table)}
						 SET ${assignments}
						 WHERE ${addressPredicate(columns)}`,
						[walletAddress, anonymousAddress],
					)
				}
				for (const relation of relations) {
					const columnResult = await client.query<{ column_name: string }>(
						`SELECT column_name
						 FROM information_schema.columns
						 WHERE table_schema = current_schema()
						   AND table_name = $1
						   AND column_name = ANY($2::text[])`,
						[relation.table, relation.identifiers],
					)
					const columns = columnResult.rows.map((row) => row.column_name)
					if (columns.length === 0) continue
					const remaining = await client.query<{ count: string }>(
						`SELECT COUNT(*)::text AS count
						 FROM ${quoteIdentifier(relation.table)}
						 WHERE ${addressPredicate(columns)}`,
						[walletAddress],
					)
					if (remaining.rows[0]?.count !== "0") {
						throw new Error(
							`Account deletion left references in ${relation.table}`,
						)
					}
				}
				await client.query(
					`INSERT INTO account_deletion_audit_log
					 (deletion_request_id, subject_address_hash, action)
					 VALUES ($1, $2, 'hard_deleted')`,
					[deletionId, addressHash],
				)
				await client.query(
					`UPDATE account_deletion_requests
					 SET status = 'completed', wallet_address = $2,
					     completed_at = NOW(), updated_at = NOW()
					 WHERE id = $1`,
					[deletionId, addressHash],
				)
				await client.query("COMMIT")
			} catch (error) {
				await client.query("ROLLBACK")
				throw error
			} finally {
				client.release()
			}
		},
	}
}

export { DATA_RELATIONS }
