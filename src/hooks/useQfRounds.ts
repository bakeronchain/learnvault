import { useCallback, useEffect, useState } from "react"

import { apiFetchJson } from "../lib/api"

export interface QfRound {
	id: number
	name: string
	matching_pool: number
	start_ts: string
	end_ts: string
	status: "upcoming" | "active" | "finalized"
	effective_status?: "upcoming" | "active" | "closed" | "finalized"
	created_at: string
}

export interface QfStanding {
	proposal_id: number
	total_contributions: number
	unique_contributors: number
	match_weight: number
	estimated_match: number
}

export interface QfStandingsResponse {
	round_id: number
	matching_pool: number
	status: "upcoming" | "active" | "closed" | "finalized"
	standings: QfStanding[]
}

interface UseQfRoundsResult {
	rounds: QfRound[]
	isLoading: boolean
	error: string | null
	reload: () => void
}

export function useQfRounds(): UseQfRoundsResult {
	const [rounds, setRounds] = useState<QfRound[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const reload = useCallback(() => {
		setIsLoading(true)
		apiFetchJson<{ rounds: QfRound[] }>("/api/qf/rounds")
			.then((data) => {
				setRounds(data.rounds ?? [])
				setError(null)
			})
			.catch((err: unknown) => {
				setError(err instanceof Error ? err.message : "Failed to load rounds")
			})
			.finally(() => setIsLoading(false))
	}, [])

	useEffect(() => {
		reload()
	}, [reload])

	return { rounds, isLoading, error, reload }
}

export interface QfStandingsResult {
	data: QfStandingsResponse | null
	isLoading: boolean
	error: string | null
	reload: () => void
}

export function useQfStandings(roundId: number | null): QfStandingsResult {
	const [data, setData] = useState<QfStandingsResponse | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const load = useCallback(() => {
		if (roundId == null) return
		setIsLoading(true)
		apiFetchJson<QfStandingsResponse>(`/api/qf/rounds/${roundId}/standings`)
			.then((res) => {
				setData(res)
				setError(null)
			})
			.catch((err: unknown) => {
				setError(err instanceof Error ? err.message : "Failed to load standings")
			})
			.finally(() => setIsLoading(false))
	}, [roundId])

	useEffect(() => {
		load()
	}, [load])

	return { data, isLoading, error, reload: load }
}

/**
 * Estimates the marginal match for a proposal if the connected donor were to
 * add `amount` as a brand-new unique contributor. Standings only expose the
 * aggregate (Σ√c)²−Σc weight per proposal, so we approximate the donor's effect
 * by adding one new √amount term to the target proposal's square-root sum. This
 * mirrors the backend's reward for broadening the donor base and is only a
 * client-side preview — the authoritative match is computed server-side.
 */
export function estimateMatchWithContribution(
	standings: QfStanding[],
	matchingPool: number,
	proposalId: number,
	amount: number,
): number {
	if (!(matchingPool > 0)) return 0

	let totalWeight = 0
	const weights = new Map<number, number>()
	for (const s of standings) {
		const w = Math.max(0, s.match_weight)
		weights.set(s.proposal_id, w)
		totalWeight += w
	}

	if (amount > 0) {
		const target = standings.find((s) => s.proposal_id === proposalId)
		const prevContributions = target?.total_contributions ?? 0
		// matchWeight = (Σ√c)² − Σc, so matchWeight + Σc = (Σ√c)². Taking the
		// square root recovers Σ√c exactly (independent of donor count). Adding a
		// new unique donor of `amount` extends the sum by √amount.
		const existingSqrtSum = Math.sqrt(
			Math.max(0, target?.match_weight ?? 0) + prevContributions,
		)
		const newSqrtSum = existingSqrtSum + Math.sqrt(amount)
		const newWeight = Math.max(
			0,
			newSqrtSum * newSqrtSum - (prevContributions + amount),
		)
		const prevWeight = weights.get(proposalId) ?? 0
		totalWeight += newWeight - prevWeight
		weights.set(proposalId, newWeight)
	}

	const w = weights.get(proposalId) ?? 0
	return totalWeight > 0 ? (matchingPool * w) / totalWeight : 0
}
