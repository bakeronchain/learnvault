import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as api from "../lib/api"
import {
	useAdminMilestones,
	useAdminStats,
	useValidatorAnalytics,
} from "./useAdmin"

const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock("../lib/api", () => ({
	apiFetchJson: vi.fn(),
	buildApiUrl: vi.fn((path) => `http://api${path}`),
	createAuthHeaders: vi.fn(() => ({ Authorization: "Bearer mock" })),
}))

describe("useValidatorAnalytics", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("maps validator analytics and queue alert payload", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				validators: [
					{
						validator_address: "GVAL123",
						milestones_reviewed: 4,
						average_review_time_seconds: 185.25,
						approval_rate: 75,
						appeal_reversal_rate: 25,
					},
				],
				review_queue: {
					pending_reviews: 19,
					threshold: 15,
					exceeded: true,
				},
			}),
		})

		const { result } = renderHook(() => useValidatorAnalytics())

		await act(async () => {
			await result.current.fetchAnalytics()
		})

		expect(result.current.error).toBeNull()
		expect(result.current.analytics).toEqual([
			{
				validatorAddress: "GVAL123",
				milestonesReviewed: 4,
				averageReviewTimeSeconds: 185.25,
				approvalRate: 75,
				appealReversalRate: 25,
			},
		])
		expect(result.current.reviewQueue).toEqual({
			pendingReviews: 19,
			threshold: 15,
			exceeded: true,
		})
	})

	it("captures request errors", async () => {
		mockFetch.mockResolvedValue({
			ok: false,
			json: async () => ({ error: "Failed to fetch validator analytics" }),
		})

		const { result } = renderHook(() => useValidatorAnalytics())

		await act(async () => {
			await result.current.fetchAnalytics()
		})

		expect(result.current.analytics).toEqual([])
		expect(result.current.error).toBe("Failed to fetch validator analytics")
	})
})

describe("useAdmin hooks", () => {
	describe("useAdminStats", () => {
		it("fetches and maps admin stats correctly", async () => {
			const mockStats = {
				pending_milestones: 5,
				approved_milestones_today: 2,
				rejected_milestones_today: 1,
				total_scholars: 10,
				total_lrn_minted: "1000",
				open_proposals: 3,
				treasury_balance_usdc: "5000",
			}
			vi.mocked(api.apiFetchJson).mockResolvedValue(mockStats)

			const { result } = renderHook(() => useAdminStats())

			await act(async () => {
				await result.current.fetchStats()
			})

			expect(result.current.stats).toEqual({
				pendingMilestones: 5,
				approvedToday: 2,
				rejectedToday: 1,
				totalScholars: 10,
				totalLrnMinted: "1000",
				openProposals: 3,
				treasuryBalanceUsdc: "5000",
			})
			expect(api.apiFetchJson).toHaveBeenCalledWith("/api/admin/stats", {
				auth: true,
			})
		})

		it("handles fetch errors", async () => {
			vi.mocked(api.apiFetchJson).mockRejectedValue(new Error("Fetch failed"))

			const { result } = renderHook(() => useAdminStats())

			await act(async () => {
				await result.current.fetchStats()
			})

			expect(result.current.error).toBe("Fetch failed")
			expect(result.current.loading).toBe(false)
		})
	})

	describe("useAdminMilestones", () => {
		it("fetches and maps milestones correctly", async () => {
			const mockMilestones = {
				data: [
					{
						id: 1,
						scholar_address: "G1",
						course_id: "course-1",
						evidence_github: "link",
						submitted_at: "2026-01-01",
						status: "pending",
					},
				],
				total: 1,
				page: 1,
				pageSize: 10,
			}
			vi.mocked(api.apiFetchJson).mockResolvedValue(mockMilestones)

			const { result } = renderHook(() => useAdminMilestones())

			await act(async () => {
				await result.current.fetchMilestones()
			})

			expect(result.current.milestones).toHaveLength(1)
			expect(result.current.milestones[0].id).toBe("1")
			expect(result.current.total).toBe(1)
		})

		it("approves a milestone and refreshes the list", async () => {
			vi.mocked(api.apiFetchJson).mockResolvedValue({})

			const { result } = renderHook(() => useAdminMilestones())

			let success = false
			await act(async () => {
				success = await result.current.approveMilestone("1")
			})

			expect(success).toBe(true)
			expect(api.apiFetchJson).toHaveBeenCalledWith(
				"/api/admin/milestones/1/approve",
				expect.objectContaining({ method: "POST" }),
			)
		})

		it("rejects a milestone and refreshes the list", async () => {
			vi.mocked(api.apiFetchJson).mockResolvedValue({})

			const { result } = renderHook(() => useAdminMilestones())

			let success = false
			await act(async () => {
				success = await result.current.rejectMilestone("1")
			})

			expect(success).toBe(true)
			expect(api.apiFetchJson).toHaveBeenCalledWith(
				"/api/admin/milestones/1/reject",
				expect.objectContaining({ method: "POST" }),
			)
		})
	})
})
