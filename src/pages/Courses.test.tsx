import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { type CourseSummary } from "../types/courses"

vi.mock("../hooks/useCourses", () => ({
	useCourses: vi.fn(),
}))

vi.mock("../components/SponsorLogosForTrack", () => ({
	default: () => <div data-testid="sponsor-logos" />,
}))

vi.mock("../components/BookmarkButton", () => ({
	default: ({ courseId }: { courseId: string }) => (
		<button data-testid={`bookmark-${courseId}`}>Bookmark</button>
	),
}))

const { useCourses } = await import("../hooks/useCourses")

const makeCourses = (): CourseSummary[] => [
	{
		id: "1",
		slug: "stellar-basics",
		title: "Stellar Basics",
		description: "Introduction to Stellar blockchain",
		track: "Stellar",
		trackKey: "stellar",
		difficulty: "beginner",
		level: "Beginner",
		published: true,
		createdAt: "2024-01-01",
		updatedAt: "2024-01-01",
		accentClassName: "from-brand-cyan/25 via-brand-blue/20 to-transparent",
		coverImage: null,
	},
	{
		id: "2",
		slug: "defi-advanced",
		title: "DeFi Advanced",
		description: "Deep dive into DeFi protocols",
		track: "DeFi",
		trackKey: "defi",
		difficulty: "advanced",
		level: "Advanced",
		published: true,
		createdAt: "2024-01-02",
		updatedAt: "2024-01-02",
		accentClassName: "from-emerald-400/25 via-teal-400/15 to-transparent",
		coverImage: null,
	},
	{
		id: "3",
		slug: "web3-intro",
		title: "Web3 Intro",
		description: "Getting started with Web3",
		track: "Web3",
		trackKey: "web3",
		difficulty: "beginner",
		level: "Beginner",
		published: true,
		createdAt: "2024-01-03",
		updatedAt: "2024-01-03",
		accentClassName: "from-sky-400/25 via-cyan-400/15 to-transparent",
		coverImage: null,
	},
	{
		id: "4",
		slug: "smart-contracts-101",
		title: "Smart Contracts 101",
		description: "Solidity fundamentals",
		track: "Smart Contracts",
		trackKey: "smartcontracts",
		difficulty: "intermediate",
		level: "Intermediate",
		published: true,
		createdAt: "2024-01-04",
		updatedAt: "2024-01-04",
		accentClassName: "from-fuchsia-400/25 via-violet-400/15 to-transparent",
		coverImage: null,
	},
	{
		id: "5",
		slug: "stellar-advanced",
		title: "Stellar Advanced",
		description: "Advanced Stellar concepts",
		track: "Stellar",
		trackKey: "stellar",
		difficulty: "advanced",
		level: "Advanced",
		published: true,
		createdAt: "2024-01-05",
		updatedAt: "2024-01-05",
		accentClassName: "from-brand-cyan/25 via-brand-blue/20 to-transparent",
		coverImage: null,
	},
]

const renderCourses = (initialEntries: string[] = ["/courses"]) => {
	return render(
		<MemoryRouter initialEntries={initialEntries}>
			<CoursesPage />
		</MemoryRouter>,
	)
}

let CoursesPage: React.ComponentType

beforeEach(async () => {
	vi.mocked(useCourses).mockReturnValue({
		courses: makeCourses(),
		isLoading: false,
		error: null,
		refetch: vi.fn(),
	})

	const mod = await import("./Courses")
	CoursesPage = mod.default
})

describe("Courses page", () => {
	it("renders all course cards", () => {
		renderCourses()

		expect(screen.getByText("Stellar Basics")).toBeInTheDocument()
		expect(screen.getByText("DeFi Advanced")).toBeInTheDocument()
		expect(screen.getByText("Web3 Intro")).toBeInTheDocument()
		expect(screen.getByText("Smart Contracts 101")).toBeInTheDocument()
		expect(screen.getByText("Page 1 of 2")).toBeInTheDocument()
	})

	it("filters courses by track", async () => {
		const user = userEvent.setup()
		renderCourses()

		const trackGroup = screen.getByRole("group", { name: /filter by track/i })
		const stellarButton = within(trackGroup).getByRole("button", {
			name: /stellar/i,
		})
		await user.click(stellarButton)

		expect(screen.getByText("Stellar Basics")).toBeInTheDocument()
		expect(screen.getByText("Stellar Advanced")).toBeInTheDocument()
		expect(screen.queryByText("DeFi Advanced")).not.toBeInTheDocument()
		expect(screen.queryByText("Web3 Intro")).not.toBeInTheDocument()
		expect(screen.queryByText("Smart Contracts 101")).not.toBeInTheDocument()
	})

	it("filters courses by difficulty", async () => {
		const user = userEvent.setup()
		renderCourses()

		const difficultyGroup = screen.getByRole("group", {
			name: /filter by difficulty/i,
		})
		const beginnerButton = within(difficultyGroup).getByRole("button", {
			name: /beginner/i,
		})
		await user.click(beginnerButton)

		expect(screen.getByText("Stellar Basics")).toBeInTheDocument()
		expect(screen.getByText("Web3 Intro")).toBeInTheDocument()
		expect(screen.queryByText("DeFi Advanced")).not.toBeInTheDocument()
		expect(screen.queryByText("Smart Contracts 101")).not.toBeInTheDocument()
		expect(screen.queryByText("Stellar Advanced")).not.toBeInTheDocument()
	})

	it("searches courses by title", async () => {
		const user = userEvent.setup()
		renderCourses()

		const searchInput = screen.getByRole("searchbox")
		await user.type(searchInput, "DeFi")

		await vi.waitFor(() => {
			expect(screen.getByText("DeFi Advanced")).toBeInTheDocument()
			expect(screen.queryByText("Stellar Basics")).not.toBeInTheDocument()
			expect(screen.queryByText("Web3 Intro")).not.toBeInTheDocument()
		})
	})

	it("paginates courses correctly", () => {
		renderCourses()

		expect(screen.getByText("Page 1 of 2")).toBeInTheDocument()
		expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled()
	})

	it("navigates to next page", async () => {
		const user = userEvent.setup()
		renderCourses()

		const nextButton = screen.getByRole("button", { name: /next/i })
		await user.click(nextButton)

		await vi.waitFor(() => {
			expect(screen.getByText("Stellar Advanced")).toBeInTheDocument()
			expect(screen.getByText("Page 2 of 2")).toBeInTheDocument()
		})
	})

	it("shows loading skeleton", () => {
		vi.mocked(useCourses).mockReturnValue({
			courses: [],
			isLoading: true,
			error: null,
			refetch: vi.fn(),
		})

		renderCourses()

		const skeletons = document.querySelectorAll(".animate-pulse")
		expect(skeletons.length).toBeGreaterThan(0)
	})

	it("shows empty state when no courses exist", () => {
		vi.mocked(useCourses).mockReturnValue({
			courses: [],
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		})

		renderCourses()

		expect(screen.getByText("No courses available")).toBeInTheDocument()
	})

	it("shows no-match state when filters return nothing", async () => {
		const user = userEvent.setup()
		renderCourses()

		const searchInput = screen.getByRole("searchbox")
		await user.type(searchInput, "nonexistent course xyz")

		await vi.waitFor(() => {
			expect(
				screen.getByText("No courses match your filters"),
			).toBeInTheDocument()
		})
	})

	it("clears filters when clear button is clicked", async () => {
		const user = userEvent.setup()
		renderCourses()

		const trackGroup = screen.getByRole("group", { name: /filter by track/i })
		const stellarButton = within(trackGroup).getByRole("button", {
			name: /stellar/i,
		})
		await user.click(stellarButton)

		const clearButton = screen.getByRole("button", { name: /clear/i })
		await user.click(clearButton)

		expect(screen.getByText("Stellar Basics")).toBeInTheDocument()
		expect(screen.getByText("DeFi Advanced")).toBeInTheDocument()
		expect(screen.getByText("Web3 Intro")).toBeInTheDocument()
	})

	it("initializes filters from URL search params", () => {
		renderCourses(["/courses?track=stellar&difficulty=beginner"])

		expect(screen.getByText("Stellar Basics")).toBeInTheDocument()
		expect(screen.queryByText("DeFi Advanced")).not.toBeInTheDocument()
		expect(screen.queryByText("Stellar Advanced")).not.toBeInTheDocument()
	})

	it("renders Open course links with correct hrefs", () => {
		renderCourses()

		const links = screen.getAllByRole("link", { name: /open course/i })
		expect(links[0]).toHaveAttribute(
			"href",
			"/courses/stellar-basics/lessons/1",
		)
	})
})
