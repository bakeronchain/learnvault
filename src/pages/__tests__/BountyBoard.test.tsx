import { render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the hooks
vi.mock("../../hooks/useBounties", () => ({
	useBounties: vi.fn(() => ({
		data: {
			data: [
				{
					id: 1,
					sponsor_addr: "GABC...WXYZ",
					title: "Build wallet analytics",
					description: "A component that shows wallet analytics data",
					skill_tags: ["typescript", "react"],
					reward_usdc: "250",
					status: "open",
					claimed_by: null,
					deadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
					created_at: new Date().toISOString(),
				},
				{
					id: 2,
					sponsor_addr: "GDEF...LMNO",
					title: "Implement escrow verification",
					description: "Verify escrow deposits on-chain",
					skill_tags: ["stellar", "soroban"],
					reward_usdc: "500",
					status: "claimed",
					claimed_by: "GLEARNER...",
					deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
					created_at: new Date().toISOString(),
				},
			],
			pagination: { page: 1, pageSize: 12, total: 2, totalPages: 1 },
		},
		isLoading: false,
		error: null,
	})),
	useBounty: vi.fn(),
	useCreateBounty: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
	useClaimBounty: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
	useSubmitWork: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
	useApproveBounty: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
	useCancelBounty: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}))

vi.mock("../../hooks/useWallet", () => ({
	useWallet: vi.fn(() => ({
		address: "GTESTWALLET111111111111111111111111111111111111111111",
		isConnected: true,
		connect: vi.fn(),
	})),
}))

vi.mock("../../hooks/useToast", () => ({
	useToast: vi.fn(() => ({
		showSuccess: vi.fn(),
		showError: vi.fn(),
	})),
}))

vi.mock("../../lib/api", () => ({
	apiFetchJson: vi.fn(),
	buildApiUrl: vi.fn((path: string) => `http://localhost:4000${path}`),
	createAuthHeaders: vi.fn(() => new Headers()),
}))

import BountyBoard from "../../pages/BountyBoard"
import BountyCard from "../../components/BountyCard"

function renderWithProviders(ui: React.ReactNode) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})
	return render(
		<MemoryRouter>
			<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
		</MemoryRouter>,
	)
}

describe("BountyBoard", () => {
	it("renders the bounty board page with title", () => {
		renderWithProviders(<BountyBoard />)
		expect(screen.getByText("Bounty Board")).toBeDefined()
	})

	it("displays bounty cards", () => {
		renderWithProviders(<BountyBoard />)
		expect(screen.getByText("Build wallet analytics")).toBeDefined()
		expect(screen.getByText("Implement escrow verification")).toBeDefined()
	})

	it("shows skill tags", () => {
		renderWithProviders(<BountyBoard />)
		expect(screen.getByText("typescript")).toBeDefined()
		expect(screen.getByText("stellar")).toBeDefined()
	})

	it("shows rewards in USDC", () => {
		renderWithProviders(<BountyBoard />)
		expect(screen.getByText("250 USDC")).toBeDefined()
		expect(screen.getByText("500 USDC")).toBeDefined()
	})

	it("shows status badges", () => {
		renderWithProviders(<BountyBoard />)
		expect(screen.getByText("open")).toBeDefined()
		expect(screen.getByText("claimed")).toBeDefined()
	})

	it("shows filter buttons", () => {
		renderWithProviders(<BountyBoard />)
		expect(screen.getByText("All")).toBeDefined()
		expect(screen.getAllByText("Open").length).toBeGreaterThanOrEqual(1)
		expect(screen.getByText("Paid")).toBeDefined()
	})

	it("shows create bounty button when connected", () => {
		renderWithProviders(<BountyBoard />)
		expect(screen.getByText("Create Bounty")).toBeDefined()
	})
})

describe("BountyCard", () => {
	const mockBounty = {
		id: 1,
		sponsor_addr: "GABC1234567890ABCDEF",
		title: "Build something cool",
		description: "A detailed description of the task",
		skill_tags: ["react", "stellar"],
		reward_usdc: "100",
		status: "open" as const,
		claimed_by: null,
		deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
		created_at: new Date().toISOString(),
		payout_tx: null,
		reward_tx: null,
		approved_at: null,
		paid_at: null,
		escrow_tx: "tx123",
	}

	it("renders title and description", () => {
		renderWithProviders(<BountyCard bounty={mockBounty} />)
		expect(screen.getByText("Build something cool")).toBeDefined()
		expect(screen.getByText("A detailed description of the task")).toBeDefined()
	})

	it("renders skill tags", () => {
		renderWithProviders(<BountyCard bounty={mockBounty} />)
		expect(screen.getByText("react")).toBeDefined()
		expect(screen.getByText("stellar")).toBeDefined()
	})

	it("renders USDC reward", () => {
		renderWithProviders(<BountyCard bounty={mockBounty} />)
		expect(screen.getByText("100 USDC")).toBeDefined()
	})

	it("links to bounty detail page", () => {
		renderWithProviders(<BountyCard bounty={mockBounty} />)
		const link = screen.getByText("Build something cool").closest("a")
		expect(link?.getAttribute("href")).toBe("/bounties/1")
	})
})

describe("Loading state", () => {
	it("shows skeleton cards while loading", async () => {
		const { useBounties } = await import("../../hooks/useBounties")
		;(useBounties as any).mockReturnValue({
			data: undefined,
			isLoading: true,
			error: null,
		})

		renderWithProviders(<BountyBoard />)
		const skeletons = document.querySelectorAll(".animate-pulse")
		expect(skeletons.length).toBeGreaterThan(0)
	})
})
