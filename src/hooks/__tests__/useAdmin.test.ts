import { renderHook, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { useAdminStats, useAdminMilestones } from "../useAdmin"
import { apiFetchJson } from "../../lib/api"

vi.mock("../../lib/api", () => ({
	apiFetchJson: vi.fn(),
}))

describe("useAdmin hooks", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("useAdminStats", () => {
		it("fetches and maps admin stats", async () => {
			const mockStats = {
				pending_milestones: 5,
				approved_milestones_today: 2,
				rejected_milestones_today: 1,
				total_scholars: 100,
				total_lrn_minted: "1000",
				open_proposals: 3,
				treasury_balance_usdc: "5000",
			}
			vi.mocked(apiFetchJson).mockResolvedValue(mockStats)

			const { result } = renderHook(() => useAdminStats())
			
			result.current.fetchStats()

			await waitFor(() => expect(result.current.loading).toBe(false))

			expect(result.current.stats).toEqual({
				pendingMilestones: 5,
				approvedToday: 2,
				rejectedToday: 1,
				totalScholars: 100,
				totalLrnMinted: "1000",
				openProposals: 3,
				treasuryBalanceUsdc: "5000",
			})
		})
	})

	describe("useAdminMilestones", () => {
		it("fetches paginated milestones", async () => {
			const mockData = {
				data: [
					{
						id: 1,
						scholar_address: "G1",
						course_id: "C1",
						status: "pending",
						submitted_at: "2024-01-01",
					},
				],
				total: 1,
				page: 1,
				pageSize: 10,
			}
			vi.mocked(apiFetchJson).mockResolvedValue(mockData)

			const { result } = renderHook(() => useAdminMilestones())
			
			result.current.fetchMilestones(1)

			await waitFor(() => expect(result.current.loading).toBe(false))

			expect(result.current.milestones).toHaveLength(1)
			expect(result.current.milestones[0].id).toBe("1")
			expect(result.current.total).toBe(1)
		})

		it("approves a milestone", async () => {
			const { result } = renderHook(() => useAdminMilestones())
			
			// Initial state would be empty, let's assume we have one
			vi.mocked(apiFetchJson).mockResolvedValueOnce({ 
        data: [{ id: 1, scholar_address: "G1", course_id: "C1", status: "pending", submitted_at: "2024-01-01" }], 
        total: 1, 
        page: 1,
        pageSize: 10
      })
			await result.current.fetchMilestones(1)

			vi.mocked(apiFetchJson).mockResolvedValueOnce({})
			const success = await result.current.approveMilestone("1")

			expect(success).toBe(true)
			expect(result.current.milestones[0].status).toBe("approved")
		})
	})
})
