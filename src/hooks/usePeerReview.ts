import { useCallback, useState } from "react"
import { apiFetchJson } from "../lib/api"

export type PeerReviewQueueItem = {
	id: number
	scholar_address: string
	course_id: string
	milestone_id: number
	evidence_github?: string | null
	evidence_ipfs_cid?: string | null
	evidence_description?: string | null
	status: "pending" | "approved" | "rejected"
	submitted_at: string
	peer_approval_count?: number
	peer_rejection_count?: number
}

type QueueResponse = { data: PeerReviewQueueItem[] }

type SubmitResponse = {
	data: { report_id: number; verdict: string; lrn_awarded: string }
}

export function usePeerReviewQueue() {
	const [items, setItems] = useState<PeerReviewQueueItem[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const refresh = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const res = await apiFetchJson<QueueResponse>("/api/peer-review/queue", {
				auth: true,
			})
			setItems(res.data ?? [])
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Failed to load queue")
		} finally {
			setLoading(false)
		}
	}, [])

	const submitReview = useCallback(
		async (
			reportId: number,
			verdict: "approve" | "reject",
			comment?: string,
		): Promise<SubmitResponse["data"] | null> => {
			setError(null)
			try {
				const res = await apiFetchJson<SubmitResponse>(
					`/api/peer-review/reports/${reportId}`,
					{
						method: "POST",
						auth: true,
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							verdict,
							...(comment?.trim() ? { comment: comment.trim() } : {}),
						}),
					},
				)
				await refresh()
				return res.data
			} catch (err: unknown) {
				setError(err instanceof Error ? err.message : "Submit failed")
				return null
			}
		},
		[refresh],
	)

	return { items, loading, error, refresh, submitReview }
}
