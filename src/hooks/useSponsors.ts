import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

export type SponsorOrganizationProfile = {
	wallet_address: string
	name: string
	logo_url: string | null
	website: string | null
	mission: string | null
	created_at?: string
	updated_at?: string
}

export type SponsorLogo = {
	wallet_address: string
	name: string
	logo_url: string | null
	website: string | null
	total_track_donated_usdc: string
	latest_sponsorship_at: string
}

export type OrganizationScholarProgress = {
	learner_address: string
	completed_milestones: number
	total_milestones: number
	completion_rate: number
}

export type QuarterlySponsorReport = {
	year: number
	quarter: number
	total_donated_usdc: string
	sponsored_tracks_count: number
	scholars_impacted: number
	milestones_completed: number
}

type TrackSponsorshipInput = {
	wallet_address: string
	track: string
	donation_usdc: number
	tx_hash?: string
}

type UpsertOrgProfileInput = {
	walletAddress: string
	name: string
	logo_url?: string
	website?: string
	mission?: string
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, {
		headers: {
			"Content-Type": "application/json",
			...(init?.headers ?? {}),
		},
		...init,
	})

	if (!response.ok) {
		const payload = await response.json().catch(() => ({}))
		throw new Error((payload as { error?: string }).error || "Request failed")
	}

	return response.json() as Promise<T>
}

export function useSponsorOrganizationProfile(walletAddress: string | undefined) {
	return useQuery({
		queryKey: ["sponsors", "organization", walletAddress],
		queryFn: async (): Promise<SponsorOrganizationProfile | null> => {
			if (!walletAddress) return null
			const response = await fetch(`/api/sponsors/organizations/${walletAddress}`)
			if (response.status === 404) return null
			if (!response.ok) throw new Error("Failed to load organization profile")
			const data =
				(await response.json()) as { profile: SponsorOrganizationProfile }
			return data.profile
		},
		enabled: Boolean(walletAddress),
		staleTime: 60 * 1000,
	})
}

export function useUpsertSponsorOrganizationProfile() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: UpsertOrgProfileInput) => {
			return fetchJson<{ profile: SponsorOrganizationProfile }>(
				`/api/sponsors/organizations/${input.walletAddress}`,
				{
					method: "PUT",
					body: JSON.stringify({
						name: input.name,
						logo_url: input.logo_url,
						website: input.website,
						mission: input.mission,
					}),
				},
			)
		},
		onSuccess: (_result, variables) => {
			void queryClient.invalidateQueries({
				queryKey: ["sponsors", "organization", variables.walletAddress],
			})
		},
	})
}

export function useCreateTrackSponsorship() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: TrackSponsorshipInput) => {
			return fetchJson<{ sponsorship: unknown }>("/api/sponsors/sponsorships", {
				method: "POST",
				body: JSON.stringify(input),
			})
		},
		onSuccess: (_result, variables) => {
			void queryClient.invalidateQueries({
				queryKey: ["sponsors", "dashboard", variables.wallet_address],
			})
			void queryClient.invalidateQueries({
				queryKey: ["sponsors", "quarterly", variables.wallet_address],
			})
			void queryClient.invalidateQueries({
				queryKey: ["sponsors", "logos", variables.track],
			})
		},
	})
}

export function useTrackSponsorLogos(track: string | undefined) {
	return useQuery({
		queryKey: ["sponsors", "logos", track],
		queryFn: async (): Promise<SponsorLogo[]> => {
			if (!track) return []
			const data = await fetchJson<{ sponsors: SponsorLogo[] }>(
				`/api/sponsors/logos?track=${encodeURIComponent(track)}`,
			)
			return data.sponsors ?? []
		},
		enabled: Boolean(track),
		staleTime: 60 * 1000,
	})
}

export function useSponsorDashboard(walletAddress: string | undefined) {
	return useQuery({
		queryKey: ["sponsors", "dashboard", walletAddress],
		queryFn: async (): Promise<{
			tracks: string[]
			scholars: OrganizationScholarProgress[]
		}> => {
			if (!walletAddress) return { tracks: [], scholars: [] }
			return fetchJson(`/api/sponsors/organizations/${walletAddress}/dashboard`)
		},
		enabled: Boolean(walletAddress),
		staleTime: 60 * 1000,
	})
}

export function useSponsorQuarterlyReports(
	walletAddress: string | undefined,
	year?: number,
	quarter?: number,
) {
	return useQuery({
		queryKey: ["sponsors", "quarterly", walletAddress, year, quarter],
		queryFn: async (): Promise<QuarterlySponsorReport[]> => {
			if (!walletAddress) return []
			const params = new URLSearchParams()
			if (year) params.set("year", String(year))
			if (quarter) params.set("quarter", String(quarter))
			const url = `/api/sponsors/organizations/${walletAddress}/reports/quarterly${
				params.toString() ? `?${params.toString()}` : ""
			}`
			const data = await fetchJson<{ reports: QuarterlySponsorReport[] }>(url)
			return data.reports ?? []
		},
		enabled: Boolean(walletAddress),
		staleTime: 60 * 1000,
	})
}

export function useUpsertScholarRegion() {
	return useMutation({
		mutationFn: async (payload: {
			learner_address: string
			country_region: string
		}) => {
			return fetchJson<{ profile: { country_region: string } }>(
				"/api/sponsors/scholar-region",
				{
					method: "PUT",
					body: JSON.stringify(payload),
				},
			)
		},
	})
}
