import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { WalletContext } from "../providers/WalletProvider"

vi.mock("./MilestoneCelebration", () => ({
	default: ({ isOpen, lessonName }: { isOpen: boolean; lessonName: string }) =>
		isOpen ? <div data-testid="celebration">{lessonName}</div> : null,
}))

const { default: StreakWidget } = await import("./StreakWidget")

global.fetch = vi.fn()

const renderWidget = (address?: string) => {
	return render(
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
			<StreakWidget />
		</WalletContext.Provider>,
	)
}

const SAMPLE_STREAK = {
	current_streak: 4,
	longest_streak: 9,
	daily_goal: 2,
	todays_progress: 1,
	goal_met: false,
	last_7_days: [
		{ date: "2026-07-16", completed: true },
		{ date: "2026-07-17", completed: true },
		{ date: "2026-07-18", completed: false },
		{ date: "2026-07-19", completed: true },
		{ date: "2026-07-20", completed: true },
		{ date: "2026-07-21", completed: true },
		{ date: "2026-07-22", completed: true },
	],
}

beforeEach(() => {
	vi.mocked(global.fetch).mockReset()
})

describe("StreakWidget", () => {
	it("renders nothing when no wallet is connected", () => {
		renderWidget(undefined)

		expect(screen.queryByLabelText(/learning streak/i)).not.toBeInTheDocument()
		expect(global.fetch).not.toHaveBeenCalled()
	})

	it("shows the current and longest streak from the API", async () => {
		vi.mocked(global.fetch).mockResolvedValue({
			ok: true,
			json: async () => ({ data: SAMPLE_STREAK }),
		} as Response)

		renderWidget("GLEARNER1")

		await waitFor(() => {
			expect(screen.getByText("4-day streak")).toBeInTheDocument()
		})
		expect(screen.getByText(/Longest: 9 days/i)).toBeInTheDocument()
		expect(screen.getByText("1/2")).toBeInTheDocument()
	})

	it("shows the goal-met message when today's goal has been reached", async () => {
		vi.mocked(global.fetch).mockResolvedValue({
			ok: true,
			json: async () => ({
				data: { ...SAMPLE_STREAK, todays_progress: 2, goal_met: true },
			}),
		} as Response)

		renderWidget("GLEARNER1")

		await waitFor(() => {
			expect(screen.getByText(/goal met/i)).toBeInTheDocument()
		})
	})

	it("lets the learner change their daily goal", async () => {
		vi.mocked(global.fetch).mockImplementation((url) => {
			if (typeof url === "string" && url.endsWith("/goal")) {
				return Promise.resolve({
					ok: true,
					json: async () => ({
						data: { learner_address: "GLEARNER1", daily_goal: 5 },
					}),
				} as Response)
			}
			return Promise.resolve({
				ok: true,
				json: async () => ({ data: { ...SAMPLE_STREAK, daily_goal: 5 } }),
			} as Response)
		})

		const user = userEvent.setup()
		renderWidget("GLEARNER1")

		const editButton = await screen.findByRole("button", { name: /edit goal/i })
		await user.click(editButton)

		const goalButton = await screen.findByRole("button", { name: "5/day" })
		await user.click(goalButton)

		await waitFor(() => {
			const putCalls = vi
				.mocked(global.fetch)
				.mock.calls.filter(
					([, init]) => (init as RequestInit | undefined)?.method === "PUT",
				)
			expect(putCalls.length).toBeGreaterThan(0)
		})
	})

	it("shows a celebration when a background refresh crosses a bonus threshold", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true })
		let call = 0
		vi.mocked(global.fetch).mockImplementation(() => {
			call += 1
			const currentStreak = call === 1 ? 6 : 7
			return Promise.resolve({
				ok: true,
				json: async () => ({
					data: { ...SAMPLE_STREAK, current_streak: currentStreak },
				}),
			} as Response)
		})

		renderWidget("GLEARNER1")

		await waitFor(() => {
			expect(screen.getByText("6-day streak")).toBeInTheDocument()
		})

		await vi.advanceTimersByTimeAsync(60_000)

		await waitFor(() => {
			expect(screen.getByTestId("celebration")).toHaveTextContent(
				"your 7-day streak",
			)
		})

		vi.useRealTimers()
	})
})
