import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useValidatorAnalytics } from "./useAdmin"

const mockFetch = vi.fn()
global.fetch = mockFetch

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
