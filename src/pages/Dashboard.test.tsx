import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import Dashboard from "./Dashboard"
import { WalletContext } from "../providers/WalletProvider"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		i18n: { resolvedLanguage: "en" },
	}),
}))

vi.mock("../hooks/useLearnerProfile", () => ({
	useLearnerProfile: vi.fn(),
}))

vi.mock("../hooks/useLearnToken", () => ({
	useLearnToken: vi.fn(),
}))

vi.mock("../hooks/useCourse", () => ({
	useCourse: vi.fn(),
}))

vi.mock("../components/ActivityFeed", () => ({
	default: () => <div>Activity Feed</div>,
}))

vi.mock("../components/MyBookmarks", () => ({
	default: () => <div>Bookmarks</div>,
}))

vi.mock("../components/LRNBalanceWidget", () => ({
	default: () => <div>Balance Widget</div>,
}))

vi.mock("../components/AddressDisplay", () => ({
	default: ({ address }: { address: string }) => <span>{address}</span>,
}))

vi.mock("../components/CourseCard", () => ({
	default: ({ title }: { title: string }) => <div>{title}</div>,
}))

import { useLearnerProfile } from "../hooks/useLearnerProfile"
import { useLearnToken } from "../hooks/useLearnToken"
import { useCourse } from "../hooks/useCourse"

const renderDashboard = (address?: string) => {
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
				<Dashboard />
			</WalletContext.Provider>
		</MemoryRouter>,
	)
}

describe("Dashboard page", () => {
	beforeEach(() => {
		vi.clearAllMocks()

		vi.mocked(useLearnerProfile).mockReturnValue({
			profile: { address: "GTEST123" },
			isLoading: false,
			error: null,
			address: "GTEST123",
		} as any)

		vi.mocked(useLearnToken).mockReturnValue({
			balance: 5000000000n,
			isLoading: false,
			mint: vi.fn(),
			isMinting: false,
		} as any)

		vi.mocked(useCourse).mockReturnValue({
			enrolledCourses: [
				{
					id: "course-1",
					title: "Blockchain Basics",
				},
				{
					id: "course-2",
					title: "Smart Contracts",
				},
			],

			getCourseProgress: vi.fn().mockReturnValue({
				courseId: "course-1",
				completedMilestoneIds: [1, 2],
				totalMilestones: 2,
			}),

			isCompletingMilestone: false,

			enroll: vi.fn(),
			completeMilestone: vi.fn(),
			submitMilestone: vi.fn(),
			submissionStatusMap: {},
			getEscrowTimeout: vi.fn(),
		} as any)
	})

	it("renders loading skeleton while data is fetching", () => {
		vi.mocked(useLearnToken).mockReturnValue({
			balance: undefined,
			isLoading: true,
			mint: vi.fn(),
			isMinting: false,
		} as any)

		const { container } = renderDashboard("GTEST123")

		expect(container.querySelector(".animate-pulse")).toBeInTheDocument()
	})

	it("shows LRN balance from useLearnToken hook", () => {
		renderDashboard("GTEST123")

		expect(screen.getByText(/LRN Balance/i)).toBeInTheDocument()
		expect(screen.getByText("500")).toBeInTheDocument()
	})

	it("shows enrolled courses list", () => {
		renderDashboard("GTEST123")

		expect(screen.getByText("Blockchain Basics")).toBeInTheDocument()
		expect(screen.getByText("Smart Contracts")).toBeInTheDocument()
	})

	it("shows reputation rank", () => {
		renderDashboard("GTEST123")

		expect(screen.getByText(/Reputation Rank/i)).toBeInTheDocument()
		expect(screen.getByText(/Top Scholar/i)).toBeInTheDocument()
	})

	it("shows empty state when no courses are enrolled", () => {
		vi.mocked(useCourse).mockReturnValue({
			enrolledCourses: [],

			getCourseProgress: vi.fn().mockReturnValue({
				courseId: "course-1",
				completedMilestoneIds: [],
				totalMilestones: 0,
			}),

			isCompletingMilestone: false,

			enroll: vi.fn(),
			completeMilestone: vi.fn(),
			submitMilestone: vi.fn(),
			submissionStatusMap: {},
			getEscrowTimeout: vi.fn(),
		} as any)

		renderDashboard("GTEST123")

		expect(
			screen.getByText(/You haven't enrolled in any courses yet/i),
		).toBeInTheDocument()
	})

	it("handles API error state gracefully", () => {
		vi.mocked(useLearnerProfile).mockReturnValue({
			profile: undefined,
			isLoading: false,
			error: "API failed",
			address: "GTEST123",
		} as any)

		renderDashboard("GTEST123")

		expect(
			screen.getByText(/Unable to load profile data right now/i),
		).toBeInTheDocument()
	})

	it("wallet not connected shows connect prompt", () => {
		renderDashboard(undefined)

		expect(
			screen.getByRole("heading", {
				name: /Connect Your Wallet/i,
			}),
		).toBeInTheDocument()
	})
})
