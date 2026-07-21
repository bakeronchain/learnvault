import { render, screen } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { type CohortDetail } from "../../hooks/useCohorts"
import CohortDetailView from "./CohortDetailView"

beforeAll(() => {
	window.matchMedia = vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	})) as unknown as typeof window.matchMedia
})

const mockUseCohortDetail = vi.fn()
const mockJoinMutate = vi.fn()
const mockLeaveMutate = vi.fn()

vi.mock("../../hooks/useCohorts", () => ({
	useCohortDetail: (id: number | null) => mockUseCohortDetail(id) as unknown,
	useJoinCohort: () => ({
		mutate: mockJoinMutate,
		isPending: false,
		error: null,
	}),
	useLeaveCohort: () => ({
		mutate: mockLeaveMutate,
		isPending: false,
		error: null,
	}),
}))

vi.mock("../../hooks/useWallet", () => ({
	useWallet: () => ({ address: "GMEMBER" }),
}))

vi.mock("../AddressDisplay", () => ({
	AddressDisplay: ({ address }: { address?: string | null }) => (
		<span>{address}</span>
	),
}))

vi.mock("../CommentSection", () => ({
	default: ({ proposalId }: { proposalId: string }) => (
		<div data-testid="comment-section">{proposalId}</div>
	),
}))

const baseCohort: CohortDetail = {
	id: 7,
	name: "Night Owls",
	course_slug: "stellar-basics",
	start_date: "2026-08-01",
	max_members: 3,
	created_by: "GMEMBER",
	created_at: "2026-07-17T00:00:00Z",
	member_count: 2,
	total_milestones: 5,
	group_completion_pct: 53,
	members: [
		{
			learner_addr: "GLEADER",
			joined_at: "2026-07-17T00:00:00Z",
			milestones_completed: 5,
			total_milestones: 5,
		},
		{
			learner_addr: "GMEMBER",
			joined_at: "2026-07-17T01:00:00Z",
			milestones_completed: 3,
			total_milestones: 5,
		},
	],
}

function mockDetail(overrides: Partial<CohortDetail> = {}) {
	mockUseCohortDetail.mockReturnValue({
		data: { ...baseCohort, ...overrides },
		isLoading: false,
		error: null,
		refetch: vi.fn(),
	})
}

beforeEach(() => {
	vi.clearAllMocks()
})

describe("CohortDetailView", () => {
	it("renders the group completion ring and member roster", () => {
		mockDetail()

		render(<CohortDetailView cohortId={7} onBack={() => {}} />)

		expect(screen.getByText("Night Owls")).toBeInTheDocument()
		expect(
			screen.getByRole("img", { name: "Group completion: 53%" }),
		).toBeInTheDocument()
		expect(screen.getByText("2/3 members")).toBeInTheDocument()
		expect(screen.getByText("GLEADER")).toBeInTheDocument()
		expect(screen.getByText("GMEMBER")).toBeInTheDocument()
	})

	it("marks the current wallet in the leaderboard and shows leave action for members", () => {
		mockDetail()

		render(<CohortDetailView cohortId={7} onBack={() => {}} />)

		expect(screen.getByText("You")).toBeInTheDocument()
		expect(
			screen.getByRole("button", { name: "Leave Squad" }),
		).toBeInTheDocument()
	})

	it("scopes the discussion thread to the cohort for members", () => {
		mockDetail()

		render(<CohortDetailView cohortId={7} onBack={() => {}} />)

		expect(screen.getByTestId("comment-section")).toHaveTextContent("cohort-7")
	})

	it("disables joining when the cohort is full and hides discussion for non-members", () => {
		mockDetail({
			member_count: 3,
			members: [
				{
					learner_addr: "GAAA",
					joined_at: "2026-07-17T00:00:00Z",
					milestones_completed: 1,
					total_milestones: 5,
				},
				{
					learner_addr: "GBBB",
					joined_at: "2026-07-17T01:00:00Z",
					milestones_completed: 1,
					total_milestones: 5,
				},
				{
					learner_addr: "GCCC",
					joined_at: "2026-07-17T02:00:00Z",
					milestones_completed: 0,
					total_milestones: 5,
				},
			],
		})

		render(<CohortDetailView cohortId={7} onBack={() => {}} />)

		const fullButton = screen.getByRole("button", { name: "Squad Full" })
		expect(fullButton).toBeDisabled()
		expect(screen.queryByTestId("comment-section")).not.toBeInTheDocument()
	})
})
