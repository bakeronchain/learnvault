import { useState, useCallback } from "react"

export interface AdminStats {
	pendingMilestones: number
	approvedToday: number
	rejectedToday: number
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

export function useAdminStats() {
	const [stats, setStats] = useState<AdminStats | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const fetchStats = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const res = await fetch("/api/admin/stats")
			if (!res.ok) throw new Error("Failed to fetch admin stats")
			const data: AdminStats = await res.json()
			setStats(data)
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
				const res = await fetch(`/api/admin/milestones?${params.toString()}`)
				if (!res.ok) throw new Error("Failed to fetch milestones")
				const result: PaginatedMilestones = await res.json()
				setMilestones(result.data)
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
		// Optimistic update
		setMilestones((prev) =>
			prev.map((m) => (m.id === id ? { ...m, status: "approved" } : m)),
		)
		try {
			const res = await fetch(`/api/admin/milestones/${id}/approve`, {
				method: "POST",
			})
			if (!res.ok) throw new Error("Approval failed")
			return true
		} catch (err: unknown) {
			// Rollback on failure
			setMilestones((prev) =>
				prev.map((m) => (m.id === id ? { ...m, status: "pending" } : m)),
			)
			setError(err instanceof Error ? err.message : "Approval failed")
			return false
		}
	}, [])

	const rejectMilestone = useCallback(async (id: string): Promise<boolean> => {
		// Optimistic update
		setMilestones((prev) =>
			prev.map((m) => (m.id === id ? { ...m, status: "rejected" } : m)),
		)
		try {
			const res = await fetch(`/api/admin/milestones/${id}/reject`, {
				method: "POST",
			})
			if (!res.ok) throw new Error("Rejection failed")
			return true
		} catch (err: unknown) {
			// Rollback on failure
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
