import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetchJson } from "../lib/api"
import {
	type Bounty,
	type BountyDetailResponse,
	type BountyListResponse,
	type CreateBountyPayload,
	type SubmitWorkPayload,
} from "../types/bounty"

const BOUNTY_BASE = "/api/bounties"

export function useBounties(filters?: {
	skill?: string
	status?: string
	page?: number
	pageSize?: number
}) {
	const params = new URLSearchParams()
	if (filters?.skill) params.set("skill", filters.skill)
	if (filters?.status) params.set("status", filters.status)
	if (filters?.page) params.set("page", String(filters.page))
	if (filters?.pageSize) params.set("pageSize", String(filters.pageSize))
	const qs = params.toString()
	const url = qs ? `${BOUNTY_BASE}?${qs}` : BOUNTY_BASE

	return useQuery<BountyListResponse>({
		queryKey: ["bounties", filters],
		queryFn: () => apiFetchJson<BountyListResponse>(url),
		staleTime: 30_000,
	})
}

export function useBounty(id: number | null) {
	return useQuery<BountyDetailResponse>({
		queryKey: ["bounty", id],
		queryFn: () => apiFetchJson<BountyDetailResponse>(`${BOUNTY_BASE}/${id}`),
		enabled: id !== null && id > 0,
		staleTime: 15_000,
	})
}

export function useCreateBounty() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (payload: CreateBountyPayload) =>
			apiFetchJson<{ bounty: Bounty }>(BOUNTY_BASE, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				auth: true,
				body: JSON.stringify(payload),
			}),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["bounties"] })
		},
	})
}

export function useClaimBounty() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (bountyId: number) =>
			apiFetchJson<{ bounty: Bounty }>(`${BOUNTY_BASE}/${bountyId}/claim`, {
				method: "POST",
				auth: true,
			}),
		onSuccess: (_data, bountyId) => {
			void qc.invalidateQueries({ queryKey: ["bounties"] })
			void qc.invalidateQueries({ queryKey: ["bounty", bountyId] })
		},
	})
}

export function useSubmitWork(bountyId: number) {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (payload: SubmitWorkPayload) =>
			apiFetchJson<{ bounty: Bounty }>(`${BOUNTY_BASE}/${bountyId}/submit`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				auth: true,
				body: JSON.stringify(payload),
			}),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["bounties"] })
			void qc.invalidateQueries({ queryKey: ["bounty", bountyId] })
		},
	})
}

export function useApproveBounty() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (bountyId: number) =>
			apiFetchJson<{ bounty: Bounty }>(`${BOUNTY_BASE}/${bountyId}/approve`, {
				method: "POST",
				auth: true,
			}),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["bounties"] })
			void qc.invalidateQueries({ queryKey: ["bounty"] })
		},
	})
}

export function useCancelBounty() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (bountyId: number) =>
			apiFetchJson<{ bounty: Bounty }>(`${BOUNTY_BASE}/${bountyId}/cancel`, {
				method: "POST",
				auth: true,
			}),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["bounties"] })
			void qc.invalidateQueries({ queryKey: ["bounty"] })
		},
	})
}
