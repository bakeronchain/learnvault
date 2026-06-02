import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useWallet } from "./useWallet"
import type { CourseRatingSummary, CourseReview } from "../types/courses"

const EMPTY_SUMMARY: CourseRatingSummary = { average: 0, count: 0 }

type ReviewsResponse = {
	reviews?: Array<{
		id?: string | number
		course_id?: string
		wallet_address?: string
		rating?: number
		text?: string
		created_at?: string
		updated_at?: string
	}>
	total?: number
	page?: number
	pageSize?: number
}

type SummaryResponse = {
	average?: number
	count?: number
	rating_summary?: { average?: number; count?: number }
}

const asJson = async <T>(response: Response): Promise<T> => {
	if (response.status === 404) {
		throw new Error("REVIEWS_UNAVAILABLE")
	}
	const payload = (await response.json().catch(() => ({}))) as T & {
		error?: string
		message?: string
	}
	if (!response.ok) {
		throw new Error(payload.error || payload.message || "Request failed")
	}
	return payload
}

const normalizeReview = (row: NonNullable<ReviewsResponse["reviews"]>[number]): CourseReview => ({
	id: String(row.id ?? crypto.randomUUID()),
	courseId: String(row.course_id ?? ""),
	walletAddress: String(row.wallet_address ?? ""),
	rating: Number(row.rating ?? 0),
	text: String(row.text ?? ""),
	createdAt: String(row.created_at ?? ""),
	updatedAt: row.updated_at,
})

export function useCourseRatingSummary(courseId: string | undefined) {
	return useQuery({
		queryKey: ["course", courseId, "ratingSummary"],
		enabled: Boolean(courseId),
		staleTime: 60_000,
		queryFn: async (): Promise<CourseRatingSummary> => {
			if (!courseId) return EMPTY_SUMMARY
			try {
				const response = await fetch(`/api/courses/${courseId}/reviews/summary`)
				const data = await asJson<SummaryResponse>(response)
				const summary = data.rating_summary ?? data
				const average = Number(summary.average ?? 0)
				const count = Number(summary.count ?? 0)
				if (!Number.isFinite(average) || !Number.isFinite(count)) return EMPTY_SUMMARY
				return { average, count }
			} catch (error) {
				if (error instanceof Error && error.message === "REVIEWS_UNAVAILABLE") {
					return EMPTY_SUMMARY
				}
				throw error
			}
		},
	})
}

export function useCourseReviews(courseId: string | undefined, page: number) {
	const { address } = useWallet()
	return useQuery({
		queryKey: ["course", courseId, "reviews", page, address],
		enabled: Boolean(courseId),
		staleTime: 30_000,
		queryFn: async (): Promise<{ reviews: CourseReview[]; total: number; page: number; pageSize: number; unavailable: boolean }> => {
			if (!courseId) {
				return { reviews: [], total: 0, page: 1, pageSize: 10, unavailable: false }
			}
			try {
				const response = await fetch(`/api/courses/${courseId}/reviews?page=${page}&limit=5`)
				const data = await asJson<ReviewsResponse>(response)
				const list = (data.reviews ?? []).map(normalizeReview)
				const mapped =
					address && address.length > 0
						? [
								...list
									.filter((r) => r.walletAddress.toLowerCase() === address.toLowerCase())
									.map((r) => ({ ...r, isOwn: true })),
								...list.filter((r) => r.walletAddress.toLowerCase() !== address.toLowerCase()),
							]
						: list
				return {
					reviews: mapped,
					total: Number(data.total ?? list.length),
					page: Number(data.page ?? page),
					pageSize: Number(data.pageSize ?? 5),
					unavailable: false,
				}
			} catch (error) {
				if (error instanceof Error && error.message === "REVIEWS_UNAVAILABLE") {
					return { reviews: [], total: 0, page, pageSize: 5, unavailable: true }
				}
				throw error
			}
		},
	})
}

export function useUpsertCourseReview(courseId: string | undefined) {
	const queryClient = useQueryClient()
	const { address } = useWallet()
	return useMutation({
		mutationFn: async (input: { rating: number; text: string }) => {
			if (!courseId) throw new Error("Missing course id")
			if (!address) throw new Error("Connect wallet first")
			const response = await fetch(`/api/courses/${courseId}/reviews`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					wallet_address: address,
					rating: input.rating,
					text: input.text,
				}),
			})
			await asJson(response)
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["course", courseId, "reviews"] })
			await queryClient.invalidateQueries({ queryKey: ["course", courseId, "ratingSummary"] })
		},
	})
}
