import { pool } from "./index"

export interface MilestoneReport {
	id: number
	scholar_address: string
	course_id: string
	milestone_id: number
	evidence_github?: string | null
	evidence_ipfs_cid?: string | null
	evidence_description?: string | null
	status: "pending" | "approved" | "rejected"
	submitted_at: string
	scholar_email?: string
	scholar_name?: string
	course_title?: string
	milestone_title?: string
	milestone_number?: number
	lrn_reward?: number
}

export interface MilestoneAuditEntry {
	id: number
	report_id: number
	validator_address: string
	decision: "approved" | "rejected"
	rejection_reason?: string | null
	contract_tx_hash?: string | null
	decided_at: string
}

export interface MilestoneReportFilters {
	courseId?: string
	status?: "pending" | "approved" | "rejected"
}

// In-memory fallback store (used when Postgres is unavailable)
class InMemoryMilestoneStore {
	private reports: MilestoneReport[] = []
	private auditLog: MilestoneAuditEntry[] = []
	private reportSeq = 1
	private auditSeq = 1

	async getPendingReports(): Promise<MilestoneReport[]> {
		return this.reports.filter((r) => r.status === "pending")
	}

	async getReportById(id: number): Promise<MilestoneReport | null> {
		return this.reports.find((r) => r.id === id) ?? null
	}

	async getReportsForScholar(
		scholarAddress: string,
		filters: MilestoneReportFilters = {},
	): Promise<MilestoneReport[]> {
		const { courseId, status } = filters
		return this.reports
			.filter((r) => r.scholar_address === scholarAddress)
			.filter((r) => (courseId ? r.course_id === courseId : true))
			.filter((r) => (status ? r.status === status : true))
			.sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
	}

	async createReport(
		data: Omit<MilestoneReport, "id" | "status" | "submitted_at">,
	): Promise<MilestoneReport> {
		const existing = this.reports.find(
			(r) =>
				r.scholar_address === data.scholar_address &&
				r.course_id === data.course_id &&
				r.milestone_id === data.milestone_id,
		)
		if (existing) {
			throw new Error("DUPLICATE_REPORT")
		}
		const report: MilestoneReport = {
			id: this.reportSeq++,
			status: "pending",
			submitted_at: new Date().toISOString(),
			...data,
		}
		this.reports.push(report)
		return report
	}

	async updateReportStatus(
		id: number,
		status: "approved" | "rejected",
	): Promise<MilestoneReport | null> {
		const report = this.reports.find((r) => r.id === id)
		if (!report) return null
		report.status = status
		return report
	}

	async addAuditEntry(
		entry: Omit<MilestoneAuditEntry, "id" | "decided_at">,
	): Promise<MilestoneAuditEntry> {
		const log: MilestoneAuditEntry = {
			id: this.auditSeq++,
			decided_at: new Date().toISOString(),
			...entry,
		}
		this.auditLog.push(log)
		return log
	}

	async getAuditForReport(reportId: number): Promise<MilestoneAuditEntry[]> {
		return this.auditLog.filter((e) => e.report_id === reportId)
	}

	async getMilestoneProgress(
		scholarAddress: string,
		courseId: string,
	): Promise<{ totalMilestones: number; approvedCount: number }> {
		const allForCourse = this.reports.filter(
			(r) => r.scholar_address === scholarAddress && r.course_id === courseId,
		)
		const approvedCount = allForCourse.filter(
			(r) => r.status === "approved",
		).length
		const totalMilestones = allForCourse.length
		return { totalMilestones, approvedCount }
	}
}

export const inMemoryMilestoneStore = new InMemoryMilestoneStore()

// Detect whether we're using real Postgres
function isRealPool(): boolean {
	return typeof (pool as any).totalCount !== "undefined"
}

export const milestoneStore = {
	async getPendingReports(): Promise<MilestoneReport[]> {
		if (!isRealPool()) return inMemoryMilestoneStore.getPendingReports()
		const result = await pool.query(
			`SELECT * FROM milestone_reports WHERE status = 'pending' ORDER BY submitted_at ASC`,
		)
		return result.rows
	},

	async getReportById(id: number): Promise<MilestoneReport | null> {
		if (!isRealPool()) return inMemoryMilestoneStore.getReportById(id)
		const result = await pool.query(
			`SELECT * FROM milestone_reports WHERE id = $1`,
			[id],
		)
		return result.rows[0] ?? null
	},

	async getReportsForScholar(
		scholarAddress: string,
		filters: MilestoneReportFilters = {},
	): Promise<MilestoneReport[]> {
		if (!isRealPool()) {
			return inMemoryMilestoneStore.getReportsForScholar(
				scholarAddress,
				filters,
			)
		}

		const values: Array<string> = [scholarAddress]
		let sql = `SELECT * FROM milestone_reports WHERE scholar_address = $1`

		if (filters.courseId) {
			values.push(filters.courseId)
			sql += ` AND course_id = $${values.length}`
		}

		if (filters.status) {
			values.push(filters.status)
			sql += ` AND status = $${values.length}`
		}

		sql += ` ORDER BY submitted_at DESC`

		const result = await pool.query(sql, values)
		return result.rows
	},

	async createReport(
		data: Omit<MilestoneReport, "id" | "status" | "submitted_at">,
	): Promise<MilestoneReport> {
		if (!isRealPool()) return inMemoryMilestoneStore.createReport(data)
		try {
			const result = await pool.query(
				`INSERT INTO milestone_reports
           (scholar_address, course_id, milestone_id, evidence_github, evidence_ipfs_cid, evidence_description)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
				[
					data.scholar_address,
					data.course_id,
					data.milestone_id,
					data.evidence_github ?? null,
					data.evidence_ipfs_cid ?? null,
					data.evidence_description ?? null,
				],
			)
			return result.rows[0]
		} catch (err: any) {
			if (err?.code === "23505") throw new Error("DUPLICATE_REPORT")
			throw err
		}
	},

	async updateReportStatus(
		id: number,
		status: "approved" | "rejected",
	): Promise<MilestoneReport | null> {
		if (!isRealPool())
			return inMemoryMilestoneStore.updateReportStatus(id, status)
		const result = await pool.query(
			`UPDATE milestone_reports SET status = $1 WHERE id = $2 RETURNING *`,
			[status, id],
		)
		return result.rows[0] ?? null
	},

	async addAuditEntry(
		entry: Omit<MilestoneAuditEntry, "id" | "decided_at">,
	): Promise<MilestoneAuditEntry> {
		if (!isRealPool()) return inMemoryMilestoneStore.addAuditEntry(entry)
		const result = await pool.query(
			`INSERT INTO milestone_audit_log
         (report_id, validator_address, decision, rejection_reason, contract_tx_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
			[
				entry.report_id,
				entry.validator_address,
				entry.decision,
				entry.rejection_reason ?? null,
				entry.contract_tx_hash ?? null,
			],
		)
		return result.rows[0]
	},

	async getMilestoneProgress(
		scholarAddress: string,
		courseId: string,
	): Promise<{ totalMilestones: number; approvedCount: number }> {
		if (!isRealPool()) {
			return inMemoryMilestoneStore.getMilestoneProgress(
				scholarAddress,
				courseId,
			)
		}
		const totalResult = await pool.query(
			`SELECT COUNT(*) AS total FROM milestones WHERE course_id = (SELECT id FROM courses WHERE slug = $1)`,
			[courseId],
		)
		const approvedResult = await pool.query(
			`SELECT COUNT(*) AS approved FROM milestone_reports WHERE scholar_address = $1 AND course_id = $2 AND status = 'approved'`,
			[scholarAddress, courseId],
		)
		return {
			totalMilestones: Number(totalResult.rows[0]?.total ?? 0),
			approvedCount: Number(approvedResult.rows[0]?.approved ?? 0),
		}
	},

	async getAuditForReport(reportId: number): Promise<MilestoneAuditEntry[]> {
		if (!isRealPool()) return inMemoryMilestoneStore.getAuditForReport(reportId)
		const result = await pool.query(
			`SELECT * FROM milestone_audit_log WHERE report_id = $1 ORDER BY decided_at ASC`,
			[reportId],
		)
		return result.rows
	},
}
