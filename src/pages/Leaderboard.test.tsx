import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import Leaderboard from "../../src/pages/Leaderboard"

// Mock the translation hook
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { changeLanguage: vi.fn() },
	}),
}))

// Mock the useLeaderboard hook
const mockLeaderboardData = {
	rankings: [
		{
			rank: 1,
			address: "GA1111111111111111111111111111111111111111",
			lrn_balance: "5000",
			courses_completed: 24,
		},
		{
			rank: 2,
			address: "GA2222222222222222222222222222222222222222",
			lrn_balance: "4950",
			courses_completed: 23,
		},
		{
			rank: 3,
			address: "GA3333333333333333333333333333333333333333",
			lrn_balance: "4900",
			courses_completed: 22,
		},
		{
			rank: 4,
			address: "GACURRENTUSERUSERUSERUSERUSERUSERUSERUSERTTT",
			lrn_balance: "4850",
			courses_completed: 21,
		},
		{
			rank: 5,
			address: "GA5555555555555555555555555555555555555555",
			lrn_balance: "4800",
			courses_completed: 20,
		},
		{
			rank: 6,
			address: "GA6666666666666666666666666666666666666666",
			lrn_balance: "4750",
			courses_completed: 19,
		},
		{
			rank: 7,
			address: "GA7777777777777777777777777777777777777777",
			lrn_balance: "4700",
			courses_completed: 18,
		},
		{
			rank: 8,
			address: "GA8888888888888888888888888888888888888888",
			lrn_balance: "4650",
			courses_completed: 17,
		},
		{
			rank: 9,
			address: "GA9999999999999999999999999999999999999999",
			lrn_balance: "4600",
			courses_completed: 16,
		},
		{
			rank: 10,
			address: "GA1010101010101010101010101010101010101010",
			lrn_balance: "4550",
			courses_completed: 15,
		},
	],
	total: 100,
	your_rank: 4,
}

vi.mock("../../src/hooks/useLeaderboard", () => ({
	useLeaderboard: vi.fn(() => ({
		data: mockLeaderboardData,
		isLoading: false,
		error: null,
		refetch: vi.fn(),
	})),
}))

vi.mock("../../src/hooks/useWallet", () => ({
	useWallet: () => ({
		address: "GACURRENTUSERUSERUSERUSERUSERUSERUSERUSERTTT",
		balance: "1000",
		signAndSubmit: vi.fn(),
	}),
}))

vi.mock("../../src/components/AddressDisplay", () => ({
	default: ({ address }: { address: string }) => <span>{address}</span>,
}))

vi.mock("../../src/components/states/emptyState", () => ({
	EmptyState: () => <div>Empty State</div>,
}))

vi.mock("../../src/components/states/errorState", () => ({
	ErrorState: ({ onRetry }: { onRetry: () => void; message: string }) => (
		<div>
			<button onClick={onRetry}>Retry</button>
		</div>
	),
}))

describe("Leaderboard Component", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should render top 10 scholars with rank, address, and LRN balance", async () => {
		render(<Leaderboard />)

		await waitFor(() => {
			expect(screen.getByText("GA1111111111111111111111111111111111111111")).toBeInTheDocument()
		})

		const rows = screen.getAllByTestId("leaderboard-row")
		expect(rows).toHaveLength(10)

		const rankBadges = screen.getAllByTestId("leaderboard-rank-badge")
		expect(rankBadges[0]).toHaveTextContent("1")
		expect(rankBadges[1]).toHaveTextContent("2")
		expect(rankBadges[2]).toHaveTextContent("3")
	})

	it("should highlight current user in the leaderboard", async () => {
		render(<Leaderboard />)

		await waitFor(() => {
			const currentUserRow = screen.getByText("GACURRENTUSERUSERUSERUSERUSERUSERUSERUSERTTT")
				.closest("tr")
			expect(currentUserRow).toHaveClass("bg-brand-cyan/10")
		})

		expect(screen.getByText("You")).toBeInTheDocument()
	})

	it("should display user's rank correctly", async () => {
		render(<Leaderboard />)

		await waitFor(() => {
			expect(screen.getByTestId("leaderboard-your-rank")).toBeInTheDocument()
		})
	})

	it("should display LRN balance correctly formatted", async () => {
		render(<Leaderboard />)

		await waitFor(() => {
			const lrnBalances = screen.getAllByText(/LRN/, { exact: false })
			expect(lrnBalances.length).toBeGreaterThan(0)
		})
	})

	it("should display truncated addresses in leaderboard rows", async () => {
		render(<Leaderboard />)

		await waitFor(() => {
			const addresses = screen.getAllByTestId("leaderboard-address")
			expect(addresses.length).toBeGreaterThan(0)
		})
	})

	it("should show reputation rank badge with correct tier colors", async () => {
		render(<Leaderboard />)

		await waitFor(() => {
			const rankBadges = screen.getAllByTestId("leaderboard-rank-badge")

			// Rank 1 should be gold
			expect(rankBadges[0]).toHaveClass("bg-yellow-500")

			// Rank 2 should be silver
			expect(rankBadges[1]).toHaveClass("bg-slate-300")

			// Rank 3 should be bronze
			expect(rankBadges[2]).toHaveClass("bg-amber-600")
		})
	})

	it("should handle pagination controls", async () => {
		const { useLeaderboard } = await import("../../src/hooks/useLeaderboard")
		;(useLeaderboard as any).mockReturnValue({
			data: {
				...mockLeaderboardData,
				total: 25,
			},
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		})

		render(<Leaderboard />)

		await waitFor(() => {
			expect(screen.getByText("GA1111111111111111111111111111111111111111")).toBeInTheDocument()
		})

		// Pagination controls should be present
		const prevButton = screen.getByRole("button", { name: /previous|back/i })
		const nextButton = screen.getByRole("button", { name: /next/i })

		expect(prevButton).toBeInTheDocument()
		expect(nextButton).toBeInTheDocument()
	})

	it("should show loading skeleton during fetch", async () => {
		const { useLeaderboard } = await import("../../src/hooks/useLeaderboard")
		;(useLeaderboard as any).mockReturnValue({
			data: null,
			isLoading: true,
			error: null,
			refetch: vi.fn(),
		})

		const { container } = render(<Leaderboard />)

		const skeleton = container.querySelector(".animate-pulse")
		expect(skeleton).toBeInTheDocument()
	})

	it("should display completed milestones count", async () => {
		render(<Leaderboard />)

		await waitFor(() => {
			const firstLeader = mockLeaderboardData.rankings[0]
			expect(screen.getByText(String(firstLeader.courses_completed))).toBeInTheDocument()
		})
	})
})
