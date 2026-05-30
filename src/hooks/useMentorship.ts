import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetchJson } from "../lib/api"

export interface MentorProfile {
	address: string
	skills: string[]
	availability: boolean
	created_at: string
}

export interface MentorshipRequest {
	id: number
	scholar_address: string
	skills_needed: string[]
	status: string
	mentor_address: string | null
	created_at: string
}

export function useMentors() {
	return useQuery({
		queryKey: ["mentorship", "mentors"],
		queryFn: () => apiFetchJson<MentorProfile[]>("/api/mentorship/mentors"),
	})
}

export function useRequestMentor() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (skillsNeeded: string[]) =>
			apiFetchJson<MentorshipRequest>("/api/mentorship/request", {
				method: "POST",
				auth: true,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ skills_needed: skillsNeeded }),
			}),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["mentorship"] })
		},
	})
}
