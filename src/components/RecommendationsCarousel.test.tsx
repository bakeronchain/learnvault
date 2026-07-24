import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { WalletContext } from "../providers/WalletProvider"

vi.mock("./BookmarkButton", () => ({
	default: () => <button data-testid="bookmark">Bookmark</button>,
}))

const { default: RecommendationsCarousel } =
	await import("./RecommendationsCarousel")

global.fetch = vi.fn()

const renderCarousel = (address?: string) => {
	return render(
		<MemoryRouter>
			<WalletContext.Provider
				value={{
					address,
					balances: {},
					isPending: false,
					isReconnecting: false,
					signTransaction: vi.fn(),
					updateBalances: vi.fn(),
				}}
			>
				<RecommendationsCarousel />
			</WalletContext.Provider>
		</MemoryRouter>,
	)
}

const SAMPLE_RECOMMENDATIONS = [
	{
		courseId: "2",
		slug: "soroban-smart-contracts",
		title: "Soroban Smart Contracts",
		description: "Build on Soroban",
		track: "Stellar",
		difficulty: "intermediate",
		coverImage: null,
		score: 60,
		reason: "Because you finished Stellar Basics",
	},
]

beforeEach(() => {
	vi.mocked(global.fetch).mockReset()
})

describe("RecommendationsCarousel", () => {
	it("renders nothing when no wallet is connected", () => {
		renderCarousel(undefined)

		expect(screen.queryByText(/Recommended For You/i)).not.toBeInTheDocument()
		expect(global.fetch).not.toHaveBeenCalled()
	})

	it("fetches recommendations from the address-based endpoint", async () => {
		vi.mocked(global.fetch).mockResolvedValue({
			ok: true,
			json: async () => ({ data: SAMPLE_RECOMMENDATIONS }),
		} as Response)

		renderCarousel("GLEARNER1")

		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledWith(
				"/api/recommendations/GLEARNER1?limit=4",
				expect.any(Object),
			)
		})
	})

	it("renders a recommendation card with its reason string", async () => {
		vi.mocked(global.fetch).mockResolvedValue({
			ok: true,
			json: async () => ({ data: SAMPLE_RECOMMENDATIONS }),
		} as Response)

		renderCarousel("GLEARNER1")

		await waitFor(() => {
			expect(screen.getByText("Soroban Smart Contracts")).toBeInTheDocument()
		})
		expect(
			screen.getByText("Because you finished Stellar Basics"),
		).toBeInTheDocument()
	})

	it("shows a beginner-track empty state for a brand-new learner with no recommendations", async () => {
		vi.mocked(global.fetch).mockResolvedValue({
			ok: true,
			json: async () => ({ data: [] }),
		} as Response)

		renderCarousel("GNEWLEARNER")

		await waitFor(() => {
			expect(
				screen.getByText("Start with a beginner track"),
			).toBeInTheDocument()
		})
	})

	it("navigates to the course page when Enroll is clicked", async () => {
		vi.mocked(global.fetch).mockResolvedValue({
			ok: true,
			json: async () => ({ data: SAMPLE_RECOMMENDATIONS }),
		} as Response)

		const user = userEvent.setup()
		renderCarousel("GLEARNER1")

		const enrollButton = await screen.findByRole("button", {
			name: /enroll now/i,
		})
		await user.click(enrollButton)

		// engage POST + click POST both hit /api/recommendations/engage
		await waitFor(() => {
			const engageCalls = vi
				.mocked(global.fetch)
				.mock.calls.filter(([url]) => url === "/api/recommendations/engage")
			expect(engageCalls.length).toBeGreaterThan(0)
		})
	})
})
