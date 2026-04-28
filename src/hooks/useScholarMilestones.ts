import { useQuery } from "@tanstack/react-query"
import { useWallet } from "./useWallet"
import { API_URL } from "../lib/api"

export interface ScholarMilestone {
	id: number
	scholar_address: string
	course_id: string
	milestone_id: number
	evidence_github: string | null
	evidence_ipfs_cid: string | null
	evidence_description: string | null
	status: string
	resubmission_count: number
}

export function useScholarMilestones() {
	const { address } = useWallet()

	return useQuery({
		queryKey: ["scholar-milestones", address],
		queryFn: async (): Promise<ScholarMilestone[]> => {
			if (!address) return []
			const response = await fetch(`${API_URL}/scholars/${address}/milestones`)
			if (!response.ok) throw new Error("Failed to fetch milestones")
			const data = await response.json()
			return data.milestones || []
		},
		enabled: !!address,
	})
}