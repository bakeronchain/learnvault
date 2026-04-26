import { useCallback, useRef, useState } from "react"
import { apiFetchJson, buildApiUrl, createAuthHeaders } from "../lib/api"

export interface AdminStats {
	pendingMilestones: number
	approvedToday: number
	rejectedToday: number
	totalScholars: number
	totalLrnMinted: string
	openProposals: number
	treasuryBalanceUsdc: string
}

export interface ValidatorAnalytics {
	validatorAddress: string
	milestonesReviewed: number
	averageReviewTimeSeconds: number
	approvalRate: number
	appealReversalRate: number
}

export interface ValidatorReviewQueue {
	pendingReviews: number
	threshold: number
	exceeded: boolean
}

export interface MilestoneSubmission {
	id: string
	learnerAddress: string
	course: string
	evidenceLink: string
	submittedAt: string
	status: "pending" | "approved" | "rejected"
	/** Non-binding peer review counts (inform admin decisions). */
	peerApprovalCount: number
	peerRejectionCount: number
}

export interface PaginatedMilestones {
	data: MilestoneSubmission[]
	total: number
	page: number
	pageSize: number
}

export interface BatchMilestoneResult {
	reportId: string
	success: boolean
	status: "approved" | "rejected" | "failed" | "not_found"
	error?: string
	contractTxHash?: string
	reason?: string
}

export interface BatchMilestoneResponse {
	action: "approve" | "reject"
	totalRequested: number
	processed: number
	succeeded: number
	failed: number
	results: BatchMilestoneResult[]
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

type ValidatorAnalyticsApi = {
	validator_address: string
	milestones_reviewed: number
	average_review_time_seconds: number
	approval_rate: number
	appeal_reversal_rate: number
}

type ValidatorAnalyticsResponse = {
	validators: ValidatorAnalyticsApi[]
	review_queue: {
		pending_reviews: number
		threshold: number
		exceeded: boolean
	}
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
	peer_approval_count?: number
	peer_rejection_count?: number
}

type PaginatedMilestonesApi = {
	data: MilestoneSubmissionApi[]
	total: number
	page: number
	pageSize: number
}

type BatchMilestoneResultApi = {
	reportId: number
	success: boolean
	status: "approved" | "rejected" | "failed" | "not_found"
	error?: string
	contractTxHash?: string
	reason?: string
}

type BatchMilestoneResponseApi = {
	data: {
		action: "approve" | "reject"
		totalRequested: number
		processed: number
		succeeded: number
		failed: number
		results: BatchMilestoneResultApi[]
	}
	error?: string
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
	peerApprovalCount: milestone.peer_approval_count ?? 0,
	peerRejectionCount: milestone.peer_rejection_count ?? 0,
})

const mapBatchMilestoneResult = (
	result: BatchMilestoneResultApi,
): BatchMilestoneResult => ({
	reportId: String(result.reportId),
	success: result.success,
	status: result.status,
	error: result.error,
	contractTxHash: result.contractTxHash,
	reason: result.reason,
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

export function useValidatorAnalytics() {
	const [analytics, setAnalytics] = useState<ValidatorAnalytics[]>([])
	const [reviewQueue, setReviewQueue] = useState<ValidatorReviewQueue | null>(
		null,
	)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const fetchAnalytics = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const data = await apiFetchJson<ValidatorAnalyticsResponse>(
				"/api/admin/validators/analytics",
				{
					auth: true,
				},
			)

			setAnalytics(
				(data.validators ?? []).map((item) => ({
					validatorAddress: item.validator_address,
					milestonesReviewed: Number(item.milestones_reviewed ?? 0),
					averageReviewTimeSeconds: Number(
						item.average_review_time_seconds ?? 0,
					),
					approvalRate: Number(item.approval_rate ?? 0),
					appealReversalRate: Number(item.appeal_reversal_rate ?? 0),
				})),
			)

			setReviewQueue({
				pendingReviews: Number(data.review_queue?.pending_reviews ?? 0),
				threshold: Number(data.review_queue?.threshold ?? 0),
				exceeded: Boolean(data.review_queue?.exceeded),
			})
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Unknown error")
		} finally {
			setLoading(false)
		}
	}, [])

	return {
		analytics,
		reviewQueue,
		loading,
		error,
		fetchAnalytics,
	}
}

export function useAdminMilestones() {
	const [milestones, setMilestones] = useState<MilestoneSubmission[]>([])
	const [total, setTotal] = useState(0)
	const [page, setPage] = useState(1)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const filtersRef = useRef<{ course?: string; status?: string }>({})
	const pageRef = useRef(1)

	const PAGE_SIZE = 10

	const fetchMilestones = useCallback(
		async (
			pageNum: number = 1,
			filters: { course?: string; status?: string } = {},
		) => {
			setLoading(true)
			setError(null)
			filtersRef.current = filters
			pageRef.current = pageNum
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

	const refreshMilestones = useCallback(async () => {
		await fetchMilestones(pageRef.current, filtersRef.current)
	}, [fetchMilestones])

	const approveMilestone = useCallback(
		async (id: string): Promise<boolean> => {
			setError(null)
			try {
				await apiFetchJson(`/api/admin/milestones/${id}/approve`, {
					method: "POST",
					auth: true,
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({}),
				})
				await refreshMilestones()
				return true
			} catch (err: unknown) {
				setMilestones((prev) =>
					prev.map((m) => (m.id === id ? { ...m, status: "pending" } : m)),
				)
				setError(err instanceof Error ? err.message : "Approval failed")
				return false
			}
		},
		[refreshMilestones],
	)

	const rejectMilestone = useCallback(
		async (id: string): Promise<boolean> => {
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
				await refreshMilestones()
				return true
			} catch (err: unknown) {
				setMilestones((prev) =>
					prev.map((m) => (m.id === id ? { ...m, status: "pending" } : m)),
				)
				setError(err instanceof Error ? err.message : "Rejection failed")
				return false
			}
		},
		[refreshMilestones],
	)

	const runBatchMilestones = useCallback(
		async (
			path:
				| "/api/admin/milestones/batch-approve"
				| "/api/admin/milestones/batch-reject",
			body: { milestoneIds: number[]; reason?: string },
		): Promise<BatchMilestoneResponse | null> => {
			setError(null)

			const response = await fetch(buildApiUrl(path), {
				method: "POST",
				headers: createAuthHeaders({
					"Content-Type": "application/json",
				}),
				body: JSON.stringify(body),
			})

			const payload = (await response
				.json()
				.catch(() => ({}))) as BatchMilestoneResponseApi

			if (!payload.data) {
				const message = payload.error || `Request failed for ${path}`
				setError(message)
				throw new Error(message)
			}

			const result = {
				action: payload.data.action,
				totalRequested: payload.data.totalRequested,
				processed: payload.data.processed,
				succeeded: payload.data.succeeded,
				failed: payload.data.failed,
				results: payload.data.results.map(mapBatchMilestoneResult),
			}

			if (!response.ok) {
				setError(payload.error || `Request failed for ${path}`)
				return result
			}

			await refreshMilestones()
			return result
		},
		[refreshMilestones],
	)

	const batchApproveMilestones = useCallback(
		async (ids: string[]): Promise<BatchMilestoneResponse | null> =>
			runBatchMilestones("/api/admin/milestones/batch-approve", {
				milestoneIds: ids.map((id) => Number(id)),
			}),
		[runBatchMilestones],
	)

	const batchRejectMilestones = useCallback(
		async (
			ids: string[],
			reason: string = "Rejected from the admin panel",
		): Promise<BatchMilestoneResponse | null> =>
			runBatchMilestones("/api/admin/milestones/batch-reject", {
				milestoneIds: ids.map((id) => Number(id)),
				reason,
			}),
		[runBatchMilestones],
	)

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
		batchApproveMilestones,
		batchRejectMilestones,
	}
}
