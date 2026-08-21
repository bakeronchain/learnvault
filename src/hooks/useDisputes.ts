import { useQuery } from "@tanstack/react-query"
import { apiFetchJson } from "../lib/api"
import {
	type DisputeDetailResponse,
	type DisputeListResponse,
	type DisputePhase,
	type JurorAssignmentsResponse,
} from "../types/dispute"

const DISPUTES_BASE = "/api/disputes"

export function useDisputes(filters?: {
	phase?: DisputePhase
	page?: number
	pageSize?: number
}) {
	const params = new URLSearchParams()
	if (filters?.phase) params.set("phase", filters.phase)
	if (filters?.page) params.set("page", String(filters.page))
	if (filters?.pageSize) params.set("pageSize", String(filters.pageSize))
	const qs = params.toString()
	const url = qs ? `${DISPUTES_BASE}?${qs}` : DISPUTES_BASE

	return useQuery<DisputeListResponse>({
		queryKey: ["disputes", filters],
		queryFn: () => apiFetchJson<DisputeListResponse>(url),
		staleTime: 15_000,
	})
}

export function useDispute(disputeId: string | null) {
	return useQuery<DisputeDetailResponse>({
		queryKey: ["dispute", disputeId],
		queryFn: () =>
			apiFetchJson<DisputeDetailResponse>(`${DISPUTES_BASE}/${disputeId}`),
		enabled: Boolean(disputeId),
		staleTime: 10_000,
	})
}

export function useJurorAssignments(address: string | null) {
	return useQuery<JurorAssignmentsResponse>({
		queryKey: ["dispute-assignments", address],
		queryFn: () =>
			apiFetchJson<JurorAssignmentsResponse>(
				`${DISPUTES_BASE}/juror/${address}`,
			),
		enabled: Boolean(address),
		staleTime: 15_000,
	})
}
