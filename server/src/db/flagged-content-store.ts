import { pool } from "./index"

export interface FlaggedContent {
	id: number
	content_type: "comment" | "proposal"
	content_id: number
	reporter_address: string
	reason: string
	flag_count: number
	status: "pending" | "reviewed" | "dismissed"
	admin_action?: "deleted" | "dismissed" | "warned"
	admin_address?: string
	admin_notes?: string
	is_hidden: boolean
	created_at: string
	reviewed_at?: string
}

export interface FlagAuditEntry {
	id: number
	flagged_id: number
	action: string
	actor_address: string
	notes?: string
	created_at: string
}

class InMemoryFlaggedContentStore {
	private flags: FlaggedContent[] = []
	private auditLog: FlagAuditEntry[] = []
	private flagSeq = 1
	private auditSeq = 1

	async createOrUpdateFlag(
		contentType: "comment" | "proposal",
		contentId: number,
		reporterAddress: string,
		reason: string,
	): Promise<FlaggedContent> {
		const existing = this.flags.find(
			(f) =>
				f.content_type === contentType &&
				f.content_id === contentId &&
				f.reporter_address === reporterAddress,
		)

		if (existing) {
			existing.flag_count += 1
			return existing
		}

		const flag: FlaggedContent = {
			id: this.flagSeq++,
			content_type: contentType,
			content_id: contentId,
			reporter_address: reporterAddress,
			reason,
			flag_count: 1,
			status: "pending",
			is_hidden: false,
			created_at: new Date().toISOString(),
		}

		this.flags.push(flag)
		return flag
	}

	async getFlaggedContent(
		status?: "pending" | "reviewed" | "dismissed",
	): Promise<FlaggedContent[]> {
		return this.flags
			.filter((f) => (status ? f.status === status : true))
			.sort((a, b) => b.created_at.localeCompare(a.created_at))
	}

	async getFlagById(id: number): Promise<FlaggedContent | null> {
		return this.flags.find((f) => f.id === id) ?? null
	}

	async getFlagsForContent(
		contentType: "comment" | "proposal",
		contentId: number,
	): Promise<FlaggedContent[]> {
		return this.flags.filter(
			(f) => f.content_type === contentType && f.content_id === contentId,
		)
	}

	async updateFlagStatus(
		id: number,
		status: "pending" | "reviewed" | "dismissed",
		adminAddress?: string,
		adminAction?: "deleted" | "dismissed" | "warned",
		adminNotes?: string,
	): Promise<FlaggedContent | null> {
		const flag = this.flags.find((f) => f.id === id)
		if (!flag) return null

		flag.status = status
		flag.reviewed_at = new Date().toISOString()
		if (adminAddress) flag.admin_address = adminAddress
		if (adminAction) flag.admin_action = adminAction
		if (adminNotes) flag.admin_notes = adminNotes

		return flag
	}

	async deleteContent(
		contentType: "comment" | "proposal",
		contentId: number,
	): Promise<void> {
		// Mark all flags for this content as hidden
		this.flags.forEach((f) => {
			if (f.content_type === contentType && f.content_id === contentId) {
				f.is_hidden = true
			}
		})
	}

	async addAuditEntry(
		flaggedId: number,
		action: string,
		actorAddress: string,
		notes?: string,
	): Promise<FlagAuditEntry> {
		const entry: FlagAuditEntry = {
			id: this.auditSeq++,
			flagged_id: flaggedId,
			action,
			actor_address: actorAddress,
			notes,
			created_at: new Date().toISOString(),
		}
		this.auditLog.push(entry)
		return entry
	}

	async getAuditForFlag(flaggedId: number): Promise<FlagAuditEntry[]> {
		return this.auditLog.filter((e) => e.flagged_id === flaggedId)
	}
}

const inMemoryStore = new InMemoryFlaggedContentStore()

function isRealPool(): boolean {
	return typeof (pool as any).totalCount !== "undefined"
}

export const flaggedContentStore = {
	async createOrUpdateFlag(
		contentType: "comment" | "proposal",
		contentId: number,
		reporterAddress: string,
		reason: string,
	): Promise<FlaggedContent> {
		if (!isRealPool()) {
			return inMemoryStore.createOrUpdateFlag(
				contentType,
				contentId,
				reporterAddress,
				reason,
			)
		}

		// Check for existing flag
		const existingResult = await pool.query(
			`SELECT * FROM flagged_content WHERE content_type = $1 AND content_id = $2 AND reporter_address = $3`,
			[contentType, contentId, reporterAddress],
		)

		if (existingResult.rows.length > 0) {
			const existing = existingResult.rows[0]
			// Update flag count
			const updateResult = await pool.query(
				`UPDATE flagged_content SET flag_count = flag_count + 1 WHERE id = $1 RETURNING *`,
				[existing.id],
			)
			return updateResult.rows[0]
		}

		// Create new flag
		const result = await pool.query(
			`INSERT INTO flagged_content (content_type, content_id, reporter_address, reason) 
			 VALUES ($1, $2, $3, $4) RETURNING *`,
			[contentType, contentId, reporterAddress, reason],
		)
		return result.rows[0]
	},

	async getFlaggedContent(
		status?: "pending" | "reviewed" | "dismissed",
	): Promise<FlaggedContent[]> {
		if (!isRealPool()) return inMemoryStore.getFlaggedContent(status)

		const result = await pool.query(
			`SELECT * FROM flagged_content ${status ? "WHERE status = $1" : ""} ORDER BY flag_count DESC, created_at DESC`,
			status ? [status] : [],
		)
		return result.rows
	},

	async getFlagById(id: number): Promise<FlaggedContent | null> {
		if (!isRealPool()) return inMemoryStore.getFlagById(id)

		const result = await pool.query(
			`SELECT * FROM flagged_content WHERE id = $1`,
			[id],
		)
		return result.rows[0] ?? null
	},

	async getFlagsForContent(
		contentType: "comment" | "proposal",
		contentId: number,
	): Promise<FlaggedContent[]> {
		if (!isRealPool()) return inMemoryStore.getFlagsForContent(contentType, contentId)

		const result = await pool.query(
			`SELECT * FROM flagged_content WHERE content_type = $1 AND content_id = $2 ORDER BY created_at DESC`,
			[contentType, contentId],
		)
		return result.rows
	},

	async updateFlagStatus(
		id: number,
		status: "pending" | "reviewed" | "dismissed",
		adminAddress?: string,
		adminAction?: "deleted" | "dismissed" | "warned",
		adminNotes?: string,
	): Promise<FlaggedContent | null> {
		if (!isRealPool()) {
			return inMemoryStore.updateFlagStatus(
				id,
				status,
				adminAddress,
				adminAction,
				adminNotes,
			)
		}

		const result = await pool.query(
			`UPDATE flagged_content SET status = $1, reviewed_at = NOW(), admin_address = $2, admin_action = $3, admin_notes = $4 WHERE id = $5 RETURNING *`,
			[status, adminAddress ?? null, adminAction ?? null, adminNotes ?? null, id],
		)
		return result.rows[0] ?? null
	},

	async deleteContent(
		contentType: "comment" | "proposal",
		contentId: number,
	): Promise<void> {
		if (!isRealPool()) {
			return inMemoryStore.deleteContent(contentType, contentId)
		}

		await pool.query(
			`UPDATE flagged_content SET is_hidden = TRUE WHERE content_type = $1 AND content_id = $2`,
			[contentType, contentId],
		)
	},

	async addAuditEntry(
		flaggedId: number,
		action: string,
		actorAddress: string,
		notes?: string,
	): Promise<FlagAuditEntry> {
		if (!isRealPool()) {
			return inMemoryStore.addAuditEntry(flaggedId, action, actorAddress, notes)
		}

		const result = await pool.query(
			`INSERT INTO flag_audit_log (flagged_id, action, actor_address, notes) VALUES ($1, $2, $3, $4) RETURNING *`,
			[flaggedId, action, actorAddress, notes ?? null],
		)
		return result.rows[0]
	},

	async getAuditForFlag(flaggedId: number): Promise<FlagAuditEntry[]> {
		if (!isRealPool()) return inMemoryStore.getAuditForFlag(flaggedId)

		const result = await pool.query(
			`SELECT * FROM flag_audit_log WHERE flagged_id = $1 ORDER BY created_at ASC`,
			[flaggedId],
		)
		return result.rows
	},
}
