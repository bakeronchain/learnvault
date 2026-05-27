import { fireEvent, render, screen, waitFor } from "../test/setup"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useWallet } from "../hooks/useWallet"
import Leaderboard from "./Leaderboard"

vi.mock("../hooks/useWallet", () => ({
	useWallet: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			if (key === "pages.leaderboard.title") return "Leaderboard"
			if (key === "pages.leaderboard.desc")
				return "Track the top scholars on LearnVault."
			return key
		},
	}),
}))

const mockUseWallet = vi.mocked(useWallet)

type LeaderboardApiEntry = {
	rank: number
	address: string
	lrn_balance: string
	courses_completed: number
}

const makeEntry = (rank: number, balance: string): LeaderboardApiEntry => ({
	rank,
	address: `GABCDEF${String(rank).padStart(4, "0")}ABCDEFGHIJKLMNOPQRSTUVWXYZ1234`,
	lrn_balance: balance,
	courses_completed: rank + 1,
})

describe("Leaderboard", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockUseWallet.mockReturnValue({
			address: null,
		} as unknown as ReturnType<typeof useWallet>)
	})

	it("renders the top 10 scholars with rank, address, and LRN", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					rankings: Array.from({ length: 10 }, (_, index) =>
						makeEntry(index + 1, String((index + 1) * 100)),
					),
					your_rank: null,
				}),
			}),
		)

		render(<Leaderboard />)

		await screen.findByText("Leaderboard")
		expect(screen.getByTestId("leader-row-1")).toBeInTheDocument()
		expect(screen.getByText("100")).toBeInTheDocument()
		expect(screen.getByText("1000")).toBeInTheDocument()
		expect(screen.getAllByText(/LRN/i).length).toBeGreaterThan(0)
	})

	it("highlights the current user when present in the list", async () => {
		const currentAddress = "GUSER1111ABCDEFGHIJKLMNOPQRSTUVWXYZ1234"
		mockUseWallet.mockReturnValue({
			address: currentAddress,
		} as unknown as ReturnType<typeof useWallet>)

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					rankings: [
						makeEntry(1, "1200"),
						{
							rank: 2,
							address: currentAddress,
							lrn_balance: "2200",
							courses_completed: 7,
						},
					],
					your_rank: 2,
				}),
			}),
		)

		render(<Leaderboard />)

		const row = await screen.findByTestId("leader-row-2")
		expect(row).toHaveAttribute("data-current-user", "true")
		expect(screen.getByText("You")).toBeInTheDocument()
	})

	it("supports pagination controls", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					rankings: Array.from({ length: 12 }, (_, index) =>
						makeEntry(index + 1, String((index + 1) * 50)),
					),
					your_rank: null,
				}),
			}),
		)

		render(<Leaderboard />)

		await screen.findByTestId("leader-row-10")
		expect(screen.queryByTestId("leader-row-11")).not.toBeInTheDocument()

		fireEvent.click(screen.getByRole("button", { name: "Next" }))

		await waitFor(() => {
			expect(screen.getByTestId("leader-row-11")).toBeInTheDocument()
		})
		expect(screen.queryByTestId("leader-row-1")).not.toBeInTheDocument()
	})

	it("shows the loading skeleton while fetching", async () => {
		let resolveFetch: ((value: unknown) => void) | null = null
		vi.stubGlobal(
			"fetch",
			vi.fn(
				() =>
					new Promise((resolve) => {
						resolveFetch = resolve
					}),
			),
		)

		render(<Leaderboard />)
		expect(screen.getByTestId("leaderboard-loading")).toBeInTheDocument()

		resolveFetch?.({
			ok: true,
			json: async () => ({ rankings: [makeEntry(1, "100")], your_rank: null }),
		})

		await screen.findByTestId("leader-row-1")
	})

	it("renders truncated addresses and the correct reputation tier badge", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					rankings: [
						{
							rank: 1,
							address: "GABCDEFGH1234567890QRSTUVWXYZ9999",
							lrn_balance: "500",
							courses_completed: 3,
						},
					],
					your_rank: 1,
				}),
			}),
		)

		render(<Leaderboard />)

		await screen.findByTestId("leader-row-1")
		expect(screen.getByText("GABCDE...9999")).toBeInTheDocument()
		expect(screen.getByTestId("leader-tier-1")).toHaveTextContent("Top Scholar")
	})
})
