import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetchJson } from "../lib/api"

export interface CohortSummary {
	id: number
	name: string
	course_slug: string
	start_date: string
	max_members: number
	created_by: string
	created_at: string
	member_count: number
}

export interface CohortMember {
	learner_addr: string
	joined_at: string
	milestones_completed: number
	total_milestones: number
}

export interface CohortDetail extends CohortSummary {
	total_milestones: number
	group_completion_pct: number
	members: CohortMember[]
}

export interface CreateCohortInput {
	name: string
	course_slug: string
	start_date: string
	max_members?: number
}

export function useCohorts(courseSlug?: string) {
	return useQuery({
		queryKey: ["cohorts", courseSlug],
		queryFn: async () => {
			const params = courseSlug
				? `?course=${encodeURIComponent(courseSlug)}`
				: ""
			const response = await apiFetchJson<{ data: CohortSummary[] }>(
				`/api/cohorts${params}`,
			)
			return response.data ?? []
		},
	})
}

export function useCohortDetail(cohortId: number | null) {
	return useQuery({
		queryKey: ["cohort", cohortId],
		queryFn: () => apiFetchJson<CohortDetail>(`/api/cohorts/${cohortId}`),
		enabled: cohortId != null,
	})
}

function useInvalidateCohorts() {
	const queryClient = useQueryClient()
	return (cohortId?: number) => {
		void queryClient.invalidateQueries({ queryKey: ["cohorts"] })
		if (cohortId != null) {
			void queryClient.invalidateQueries({ queryKey: ["cohort", cohortId] })
		}
	}
}

export function useCreateCohort() {
	const invalidate = useInvalidateCohorts()
	return useMutation({
		mutationFn: (input: CreateCohortInput) =>
			apiFetchJson<CohortSummary>("/api/cohorts", {
				method: "POST",
				auth: true,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(input),
			}),
		onSuccess: () => invalidate(),
	})
}

export function useJoinCohort() {
	const invalidate = useInvalidateCohorts()
	return useMutation({
		mutationFn: (cohortId: number) =>
			apiFetchJson<{ joined: boolean; member_count: number }>(
				`/api/cohorts/${cohortId}/join`,
				{ method: "POST", auth: true },
			),
		onSuccess: (_data, cohortId) => invalidate(cohortId),
	})
}

export function useLeaveCohort() {
	const invalidate = useInvalidateCohorts()
	return useMutation({
		mutationFn: (cohortId: number) =>
			apiFetchJson<{ left: boolean }>(`/api/cohorts/${cohortId}/leave`, {
				method: "POST",
				auth: true,
			}),
		onSuccess: (_data, cohortId) => invalidate(cohortId),
	})
}
