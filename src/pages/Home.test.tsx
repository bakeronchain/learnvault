import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { render, screen } from "../test/setup"

vi.mock("../hooks/useImpactMetrics", () => ({
	useImpactWidgetData: vi.fn(),
}))

vi.mock("../hooks/useWallet", () => ({
	useWallet: vi.fn(),
}))

vi.mock("../hooks/useCourses", () => ({
	useEnrolledCourses: vi.fn(),
}))

vi.mock("../pages/Courses", () => ({
	default: () => <div>Courses Page</div>,
}))

import App from "../App"
import Home from "./Home"
import { useImpactWidgetData } from "../hooks/useImpactMetrics"
import { useWallet } from "../hooks/useWallet"
import { useEnrolledCourses } from "../hooks/useCourses"

const mockImpactData = {
	total_scholars_funded: 325,
	total_lrn_minted: "1,200,000",
	generated_at: "2026-05-26T00:00:00.000Z",
	total_usdc_disbursed: "42,000",
}

const setupMocks = ({ address, impactData, enrolledCourses }: {
	address?: string
	impactData?: typeof mockImpactData
	enrolledCourses?: Array<unknown>
}) => {
	vi.mocked(useWallet).mockReturnValue({
		address,
		balances: {},
		isPending: false,
		isReconnecting: false,
		network: "TESTNET",
		networkPassphrase: "Test SDF Network ; September 2015",
		signTransaction: vi.fn().mockResolvedValue("signed-xdr-mock"),
		updateBalances: vi.fn().mockResolvedValue(undefined),
	})
	vi.mocked(useImpactWidgetData).mockReturnValue({
		data: impactData,
		isLoading: false,
		isFetching: false,
		isError: false,
		refetch: vi.fn(),
	} as any)
	vi.mocked(useEnrolledCourses).mockReturnValue({
		enrolledCourses: enrolledCourses ?? [],
		isLoading: false,
		error: null,
		refetch: vi.fn(),
	})
}

describe("Home page", () => {
	it("renders hero, impact stats, features, how it works, and stats sections", () => {
		setupMocks({ impactData: mockImpactData, enrolledCourses: [] })

		render(
			<MemoryRouter>
				<Home />
			</MemoryRouter>,
		)

		expect(screen.getByRole("heading", { name: /Learning is the proof of work/i })).toBeInTheDocument()
		expect(screen.getByRole("heading", { name: /How It Works/i })).toBeInTheDocument()
		expect(screen.getByRole("heading", { name: /What You Get/i })).toBeInTheDocument()
		expect(screen.getByTestId("impact-stats")).toBeInTheDocument()
		expect(screen.getByText(/Scholars funded/i)).toBeInTheDocument()
		expect(screen.getByText(/LRN minted/i)).toBeInTheDocument()
	})

	it("navigates to /courses when the Start Learning CTA is clicked", async () => {
		setupMocks({ impactData: mockImpactData, enrolledCourses: [] })

		render(
			<MemoryRouter initialEntries={["/"]}>
				<App />
			</MemoryRouter>,
		)

		const cta = await screen.findByRole("link", { name: /Start Learning/i })
		await userEvent.click(cta)

		expect(await screen.findByText("Courses Page")).toBeInTheDocument()
	})

	it("shows Go to Dashboard when a wallet is connected", () => {
		setupMocks({ address: "GTEST1234567890ABCDEFGHIJKLMN9876543210ZYXWVUTSRQPO", impactData: mockImpactData, enrolledCourses: [] })

		render(
			<MemoryRouter>
				<Home />
			</MemoryRouter>,
		)

		expect(screen.getByRole("link", { name: /Go to Dashboard/i })).toHaveAttribute(
			"href",
			"/dashboard",
		)
	})

	it("renders total scholars and LRN minted from the impact API", () => {
		setupMocks({ impactData: mockImpactData, enrolledCourses: [] })

		render(
			<MemoryRouter>
				<Home />
			</MemoryRouter>,
		)

		expect(screen.getByText("325")).toBeInTheDocument()
		expect(screen.getByText("1,200,000")).toBeInTheDocument()
	})

	it("opens and closes the mobile menu", async () => {
		setupMocks({ impactData: mockImpactData, enrolledCourses: [] })

		render(
			<MemoryRouter initialEntries={["/"]}>
				<App />
			</MemoryRouter>,
		)

		const menuToggle = screen.getByRole("button", { name: /Open navigation menu/i })
		expect(menuToggle).toHaveAttribute("aria-expanded", "false")

		await userEvent.click(menuToggle)
		expect(menuToggle).toHaveAttribute("aria-expanded", "true")
		expect(screen.getByLabelText(/Mobile primary/i)).toHaveClass("translate-x-0")

		const closeButton = screen.getByRole("button", { name: /Close mobile navigation menu/i })
		await userEvent.click(closeButton)
		expect(menuToggle).toHaveAttribute("aria-expanded", "false")
	})
})
