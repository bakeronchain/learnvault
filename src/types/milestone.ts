export interface MilestoneReportFormValues {
	courseId: string
	milestoneId: string
	evidenceGithub: string
	evidenceIpfsCid: string
	evidenceDescription: string
	acceptedTerms: boolean
}

export type MilestoneReportStatus =
	| "pending"
	| "approved"
	| "rejected"
	| "appealed"
	| "final_rejected"

export interface SubmittedMilestoneReport {
	id: number
	scholar_address: string
	course_id: string
	milestone_id: number
	evidence_github: string | null
	evidence_ipfs_cid: string | null
	evidence_description: string | null
	status: MilestoneReportStatus
	appeal_reason: string | null
	appeal_submitted_at: string | null
}
