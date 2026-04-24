import { useCallback, useState } from "react"
import { apiFetchJson } from "../lib/api"

export interface AdminStats {
	pendingMilestones: number
	approvedToday: number
	rejectedToday: number
	totalScholars: number
	totalLrnMinted: string
	openProposals: number
	treasuryBalanceUsdc: string
}

export interface MilestoneSubmission {
	id: string
	learnerAddress: string
	course: string
	evidenceLink: string
	submittedAt: string
	status: "pending" | "approved" | "rejected"
}

export interface PaginatedMilestones {
	data: MilestoneSubmission[]
	total: number
	page: number
	pageSize: number
}

type AdminStatsResponse = {
	pending_milestones: number
	approved_milestones_today: number
	rejected_milestones_today: number
	total_scholars: number
	total_lrn_minted: string
	open_proposals: number
	treasury_balance_usdc: string
}

type MilestoneSubmissionApi = {
	id: number
	scholar_address: string
	course_id: string
	evidence_github?: string | null
	evidence_ipfs_cid?: string | null
	evidence_description?: string | null
	submitted_at: string
	status: "pending" | "approved" | "rejected"
}

type PaginatedMilestonesApi = {
	data: MilestoneSubmissionApi[]
	total: number
	page: number
	pageSize: number
}

const mapMilestoneSubmission = (
	milestone: MilestoneSubmissionApi,
): MilestoneSubmission => ({
	id: String(milestone.id),
	learnerAddress: milestone.scholar_address,
	course: milestone.course_id,
	evidenceLink:
		milestone.evidence_github ??
		milestone.evidence_ipfs_cid ??
		milestone.evidence_description ??
		"",
	submittedAt: milestone.submitted_at,
	status: milestone.status,
})

export function useAdminStats() {
	const [stats, setStats] = useState<AdminStats | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const fetchStats = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const data = await apiFetchJson<AdminStatsResponse>("/api/admin/stats", {
				auth: true,
			})
			setStats({
				pendingMilestones: Number(data.pending_milestones ?? 0),
				approvedToday: Number(data.approved_milestones_today ?? 0),
				rejectedToday: Number(data.rejected_milestones_today ?? 0),
				totalScholars: Number(data.total_scholars ?? 0),
				totalLrnMinted: data.total_lrn_minted ?? "0",
				openProposals: Number(data.open_proposals ?? 0),
				treasuryBalanceUsdc: data.treasury_balance_usdc ?? "0",
			})
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Unknown error")
		} finally {
			setLoading(false)
		}
	}, [])

	return { stats, loading, error, fetchStats }
}

export function useAdminMilestones() {
	const [milestones, setMilestones] = useState<MilestoneSubmission[]>([])
	const [total, setTotal] = useState(0)
	const [page, setPage] = useState(1)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const PAGE_SIZE = 10

	const fetchMilestones = useCallback(
		async (
			pageNum: number = 1,
			filters: { course?: string; status?: string } = {},
		) => {
			setLoading(true)
			setError(null)
			try {
				const params = new URLSearchParams({
					page: String(pageNum),
					pageSize: String(PAGE_SIZE),
					...(filters.course ? { course: filters.course } : {}),
					...(filters.status ? { status: filters.status } : {}),
				})
				const result = await apiFetchJson<PaginatedMilestonesApi>(
					`/api/admin/milestones?${params.toString()}`,
					{
						auth: true,
					},
				)
				setMilestones(result.data.map(mapMilestoneSubmission))
				setTotal(result.total)
				setPage(result.page)
			} catch (err: unknown) {
				setError(err instanceof Error ? err.message : "Unknown error")
			} finally {
				setLoading(false)
			}
		},
		[],
	)

	const approveMilestone = useCallback(async (id: string): Promise<boolean> => {
		setMilestones((prev) =>
			prev.map((m) => (m.id === id ? { ...m, status: "approved" } : m)),
		)
		try {
			await apiFetchJson(`/api/admin/milestones/${id}/approve`, {
				method: "POST",
				auth: true,
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({}),
			})
			return true
		} catch (err: unknown) {
			setMilestones((prev) =>
				prev.map((m) => (m.id === id ? { ...m, status: "pending" } : m)),
			)
			setError(err instanceof Error ? err.message : "Approval failed")
			return false
		}
	}, [])

	const rejectMilestone = useCallback(async (id: string): Promise<boolean> => {
		setMilestones((prev) =>
			prev.map((m) => (m.id === id ? { ...m, status: "rejected" } : m)),
		)
		try {
			await apiFetchJson(`/api/admin/milestones/${id}/reject`, {
				method: "POST",
				auth: true,
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					reason: "Rejected from the admin panel",
				}),
			})
			return true
		} catch (err: unknown) {
			setMilestones((prev) =>
				prev.map((m) => (m.id === id ? { ...m, status: "pending" } : m)),
			)
			setError(err instanceof Error ? err.message : "Rejection failed")
			return false
		}
	}, [])

	return {
		milestones,
		total,
		page,
		pageSize: PAGE_SIZE,
		loading,
		error,
		fetchMilestones,
		approveMilestone,
		rejectMilestone,
	}
}
