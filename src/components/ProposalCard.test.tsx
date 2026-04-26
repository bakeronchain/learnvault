import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import ProposalCard from "./ProposalCard"

// Mock AddressDisplay and ProposalCountdown to simplify testing
vi.mock("./AddressDisplay", () => ({
	default: ({ address }: { address: string }) => <div data-testid="address-display">{address}</div>,
}))
vi.mock("./ProposalCountdown", () => ({
	default: ({ deadlineLedger }: { deadlineLedger: number }) => (
		<div data-testid="proposal-countdown">Deadline: {deadlineLedger}</div>
	),
}))

// Mock @stellar/design-system components
vi.mock("@stellar/design-system", () => ({
	Card: ({ children, className }: any) => <div className={className} data-testid="mock-card">{children}</div>,
	Badge: ({ children, variant }: any) => <span data-testid="mock-badge" data-variant={variant}>{children}</span>,
	Button: ({ children, onClick, disabled }: any) => (
		<button onClick={onClick} disabled={disabled}>{children}</button>
	),
}))

const defaultProps = {
	id: 1,
	proposerAddress: "GABC123",
	title: "Test Proposal",
	amountUsdc: 1000,
	yesVotes: 60,
	noVotes: 40,
	deadlineLedger: 1000,
	currentLedger: 500,
	status: "active" as const,
	hasVoted: false,
	onVoteYes: vi.fn(),
	onVoteNo: vi.fn(),
}

describe("ProposalCard", () => {
	it("renders proposal details correctly", () => {
		render(<ProposalCard {...defaultProps} />)

		expect(screen.getByText("Test Proposal")).toBeDefined()
		expect(screen.getByTestId("address-display")).toHaveTextContent("GABC123")
		expect(screen.getByText("1000 USDC")).toBeDefined()
		expect(screen.getByText("ACTIVE")).toBeDefined()
	})

	it("displays correct vote percentages", () => {
		render(<ProposalCard {...defaultProps} />)

		expect(screen.getByText(/YES: 60 \(60%\)/)).toBeDefined()
		expect(screen.getByText(/NO: 40 \(40%\)/)).toBeDefined()
	})

	it("calls onVoteYes when Yes button is clicked", () => {
		render(<ProposalCard {...defaultProps} />)

		const yesButton = screen.getByRole("button", { name: /Vote YES/i })
		fireEvent.click(yesButton)

		expect(defaultProps.onVoteYes).toHaveBeenCalled()
	})

	it("calls onVoteNo when No button is clicked", () => {
		render(<ProposalCard {...defaultProps} />)

		const noButton = screen.getByRole("button", { name: /Vote NO/i })
		fireEvent.click(noButton)

		expect(defaultProps.onVoteNo).toHaveBeenCalled()
	})

	it("disables buttons when proposal is closed", () => {
		render(<ProposalCard {...defaultProps} status="passed" />)

		const yesButton = screen.getByRole("button", { name: /Vote YES/i })
		const noButton = screen.getByRole("button", { name: /Vote NO/i })

		expect(yesButton).toBeDisabled()
		expect(noButton).toBeDisabled()
	})

	it("disables buttons and shows message when user has already voted", () => {
		render(<ProposalCard {...defaultProps} hasVoted={true} />)

		const yesButton = screen.getByRole("button", { name: /Vote YES/i })
		const noButton = screen.getByRole("button", { name: /Vote NO/i })

		expect(yesButton).toBeDisabled()
		expect(noButton).toBeDisabled()
		expect(screen.getByText(/You have already cast your vote/i)).toBeDefined()
	})
})
