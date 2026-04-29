import { useQuery } from "@tanstack/react-query"

export type ImpactTotals = {
	total_scholars_funded: number
	total_usdc_disbursed: string
	average_course_completion_rate: number
	total_lrn_minted: string
}

export type ImpactRegion = {
	country_region: string
	scholar_count: number
}

export type TopCompletedCourse = {
	course_id: string
	course_title: string
	completed_count: number
}

export type QuarterlyTrend = {
	quarter: string
	scholars_funded: number
	usdc_disbursed: string
}

export type ImpactMetricsPayload = {
	totals: ImpactTotals
	countries_regions: ImpactRegion[]
	top_completed_courses: TopCompletedCourse[]
	trends: {
		quarterly: QuarterlyTrend[]
	}
	generated_at: string
}

async function fetchImpactMetrics(): Promise<ImpactMetricsPayload> {
	const response = await fetch("/api/impact/metrics")
	if (!response.ok) {
		const payload = await response.json().catch(() => ({}))
		throw new Error(
			(payload as { error?: string }).error || "Failed to fetch impact metrics",
		)
	}
	return response.json() as Promise<ImpactMetricsPayload>
}

async function fetchImpactWidget(): Promise<{
	total_scholars_funded: number
	total_usdc_disbursed: string
	total_lrn_minted: string
	generated_at: string
}> {
	const response = await fetch("/api/impact/widget")
	if (!response.ok) {
		const payload = await response.json().catch(() => ({}))
		throw new Error(
			(payload as { error?: string }).error || "Failed to fetch impact widget",
		)
	}
	return response.json() as Promise<{
		total_scholars_funded: number
		total_usdc_disbursed: string
		total_lrn_minted: string
		generated_at: string
	}>
}

export function useImpactMetrics() {
	return useQuery({
		queryKey: ["impact", "metrics"],
		queryFn: fetchImpactMetrics,
		staleTime: 60 * 1000,
	})
}

export function useImpactWidgetData() {
	return useQuery({
		queryKey: ["impact", "widget"],
		queryFn: fetchImpactWidget,
		staleTime: 60 * 1000,
	})
}
